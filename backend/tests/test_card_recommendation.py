# backend/tests/test_card_recommendation.py
"""
Tests for POST /api/v1/cards/recommend

Coverage:
  - No cards → empty result
  - Category match (exact) → benefit selected
  - "전체" fallback when no exact match
  - monthly_cap applied correctly
  - performance_bonus for near-target cards
  - catalog_benefits fallback when no user_card_benefits
  - user_card_benefits take priority over catalog_benefits
  - min_amount filter
  - higher score card ranked first
  - user isolation
  - 401 without auth
"""

import uuid as _uuid

import sqlalchemy as sa

from app.core.database import engine
from tests.conftest import register_and_login


# ── helpers ───────────────────────────────────────────────────────────────────


def _create_user_card(client, headers, payload=None):
    resp = client.post("/api/v1/cards/", headers=headers, json=payload or {"type": "credit_card", "name": "테스트카드"})
    assert resp.status_code == 201, resp.text
    return resp.json()


def _add_benefit(client, headers, card_id, payload):
    resp = client.post(f"/api/v1/cards/{card_id}/benefits", headers=headers, json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _recommend(client, headers, merchant_name="스타벅스", amount=10000, category=None):
    body = {"merchant_name": merchant_name, "amount": amount}
    if category is not None:
        body["category"] = category
    resp = client.post("/api/v1/cards/recommend", headers=headers, json=body)
    assert resp.status_code == 200, resp.text
    return resp.json()


def _insert_catalog_card(name="카탈로그카드", issuer="카탈로그카드사"):
    catalog_id = str(_uuid.uuid4())
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO card_catalog (id, name, issuer, card_type, is_active, created_at) "
                "VALUES (:id, :name, :issuer, 'credit_card', true, NOW())"
            ),
            {"id": catalog_id, "name": name, "issuer": issuer},
        )
    return catalog_id


def _insert_catalog_benefit(catalog_id, category="전체", benefit_type="cashback", rate=2.0, monthly_cap=None, min_amount=None, flat_amount=None):
    benefit_id = str(_uuid.uuid4())
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO catalog_benefits "
                "(id, catalog_id, category, benefit_type, rate, flat_amount, monthly_cap, min_amount, created_at) "
                "VALUES (:id, :catalog_id, :category, :benefit_type, :rate, :flat_amount, :monthly_cap, :min_amount, NOW())"
            ),
            {
                "id": benefit_id,
                "catalog_id": catalog_id,
                "category": category,
                "benefit_type": benefit_type,
                "rate": rate,
                "flat_amount": flat_amount,
                "monthly_cap": monthly_cap,
                "min_amount": min_amount,
            },
        )
    return benefit_id


def _link_card_to_catalog(card_id, catalog_id):
    with engine.begin() as conn:
        conn.execute(
            sa.text("UPDATE user_cards SET catalog_id = :catalog_id WHERE id = :card_id"),
            {"catalog_id": catalog_id, "card_id": card_id},
        )


# ── tests ─────────────────────────────────────────────────────────────────────


def test_recommend_no_cards_returns_empty(client, auth_headers):
    results = _recommend(client, auth_headers)
    assert results == []


def test_recommend_card_without_benefits_excluded(client, auth_headers):
    _create_user_card(client, auth_headers)
    # Card has no benefits and no catalog link → excluded
    results = _recommend(client, auth_headers, category="식비")
    assert results == []


def test_recommend_exact_category_match(client, auth_headers):
    card = _create_user_card(client, auth_headers, {"type": "credit_card", "name": "식비카드"})
    _add_benefit(client, auth_headers, card["id"], {
        "category": "식비",
        "benefit_type": "cashback",
        "rate": 3.0,
        "monthly_cap": 10000,
    })
    results = _recommend(client, auth_headers, amount=10000, category="식비")
    assert len(results) == 1
    assert results[0]["card_id"] == card["id"]
    assert results[0]["benefit_type"] == "cashback"
    assert results[0]["effective_value"] == 300  # 10000 * 3% = 300


def test_recommend_no_category_matches_jeonche(client, auth_headers):
    """Category=None: only '전체' benefits should match."""
    card = _create_user_card(client, auth_headers)
    _add_benefit(client, auth_headers, card["id"], {
        "category": "전체",
        "benefit_type": "cashback",
        "rate": 1.0,
    })
    results = _recommend(client, auth_headers, amount=20000, category=None)
    assert len(results) == 1
    assert results[0]["effective_value"] == 200  # 20000 * 1% = 200


def test_recommend_jeonche_benefit_applies_to_any_category(client, auth_headers):
    """A '전체' benefit should appear even when a specific category is queried."""
    card = _create_user_card(client, auth_headers)
    _add_benefit(client, auth_headers, card["id"], {
        "category": "전체",
        "benefit_type": "cashback",
        "rate": 1.5,
    })
    results = _recommend(client, auth_headers, amount=10000, category="쇼핑")
    assert len(results) == 1
    assert results[0]["effective_value"] == 150


def test_recommend_monthly_cap_applied(client, auth_headers):
    """Benefit is capped at monthly_cap."""
    card = _create_user_card(client, auth_headers)
    # 10% cashback but capped at 500
    _add_benefit(client, auth_headers, card["id"], {
        "category": "전체",
        "benefit_type": "cashback",
        "rate": 10.0,
        "monthly_cap": 500,
    })
    # 10% of 50000 = 5000, but cap is 500
    results = _recommend(client, auth_headers, amount=50000, category=None)
    assert results[0]["effective_value"] == 500


def test_recommend_performance_bonus_near_target(client, auth_headers):
    """Card with < 20% remaining gets performance_bonus (is_near_target=True)."""
    from datetime import date
    import sqlalchemy as sa

    card = _create_user_card(client, auth_headers, {
        "type": "credit_card",
        "name": "실적임박카드",
        "monthly_target": 100000,
        "billing_day": None,
    })
    _add_benefit(client, auth_headers, card["id"], {
        "category": "전체",
        "benefit_type": "cashback",
        "rate": 1.0,
    })

    # Add spending so remaining = 100000 - 95000 = 5000 (5% = < 20%)
    today = date.today()
    mid = today.replace(day=min(today.day, 15))
    resp = client.post("/api/v1/transactions/", headers=auth_headers, json={
        "type": "expense",
        "amount": 95000,
        "transacted_at": f"{mid}T10:00:00+00:00",
        "user_card_id": card["id"],
    })
    assert resp.status_code == 201

    results = _recommend(client, auth_headers, amount=10000, category=None)
    assert len(results) == 1
    assert results[0]["is_near_target"] is True


def test_recommend_performance_bonus_not_near_target(client, auth_headers):
    """Card with >= 20% remaining does NOT get performance_bonus."""
    card = _create_user_card(client, auth_headers, {
        "type": "credit_card",
        "name": "여유카드",
        "monthly_target": 100000,
        "billing_day": None,
    })
    _add_benefit(client, auth_headers, card["id"], {
        "category": "전체",
        "benefit_type": "cashback",
        "rate": 1.0,
    })
    results = _recommend(client, auth_headers, amount=10000, category=None)
    assert results[0]["is_near_target"] is False


def test_recommend_catalog_fallback(client, auth_headers):
    """When user has no user_card_benefits but card links to catalog, catalog benefits are used."""
    catalog_id = _insert_catalog_card()
    _insert_catalog_benefit(catalog_id, category="전체", benefit_type="cashback", rate=2.0)

    card = _create_user_card(client, auth_headers, {"type": "credit_card", "name": "카탈로그연결카드"})
    _link_card_to_catalog(card["id"], catalog_id)

    results = _recommend(client, auth_headers, amount=10000, category=None)
    assert len(results) == 1
    assert results[0]["effective_value"] == 200  # 10000 * 2%


def test_recommend_user_benefits_override_catalog(client, auth_headers):
    """user_card_benefits take priority over catalog_benefits."""
    catalog_id = _insert_catalog_card()
    _insert_catalog_benefit(catalog_id, category="전체", benefit_type="cashback", rate=1.0)

    card = _create_user_card(client, auth_headers, {"type": "credit_card", "name": "오버라이드카드"})
    _link_card_to_catalog(card["id"], catalog_id)

    # User-defined benefit overrides catalog (5% instead of 1%)
    _add_benefit(client, auth_headers, card["id"], {
        "category": "전체",
        "benefit_type": "cashback",
        "rate": 5.0,
    })

    results = _recommend(client, auth_headers, amount=10000, category=None)
    assert results[0]["effective_value"] == 500  # 5%, not 1%


def test_recommend_min_amount_filter(client, auth_headers):
    """If payment amount < min_amount, benefit is excluded."""
    card = _create_user_card(client, auth_headers)
    _add_benefit(client, auth_headers, card["id"], {
        "category": "전체",
        "benefit_type": "cashback",
        "rate": 3.0,
        "min_amount": 50000,
    })
    # Amount 1000 < min_amount 50000 → no valid benefit
    results = _recommend(client, auth_headers, amount=1000, category=None)
    assert results == []


def test_recommend_higher_score_ranked_first(client, auth_headers):
    """Card with higher effective_value appears first."""
    card_a = _create_user_card(client, auth_headers, {"type": "credit_card", "name": "저혜택카드"})
    card_b = _create_user_card(client, auth_headers, {"type": "credit_card", "name": "고혜택카드"})

    _add_benefit(client, auth_headers, card_a["id"], {
        "category": "전체", "benefit_type": "cashback", "rate": 1.0,
    })
    _add_benefit(client, auth_headers, card_b["id"], {
        "category": "전체", "benefit_type": "cashback", "rate": 5.0,
    })

    results = _recommend(client, auth_headers, amount=10000, category=None)
    assert len(results) == 2
    assert results[0]["card_name"] == "고혜택카드"
    assert results[1]["card_name"] == "저혜택카드"


def test_recommend_user_isolation(client, auth_headers):
    """Another user's cards must not appear in recommendations."""
    headers2 = register_and_login(client, "other@example.com")
    card2 = _create_user_card(client, headers2)
    _add_benefit(client, headers2, card2["id"], {
        "category": "전체", "benefit_type": "cashback", "rate": 5.0,
    })

    # User 1 has no cards
    results = _recommend(client, auth_headers, amount=10000, category=None)
    assert results == []


def test_recommend_requires_auth(client):
    resp = client.post("/api/v1/cards/recommend", json={"merchant_name": "스타벅스"})
    assert resp.status_code in (401, 403)


def test_recommend_default_amount_when_not_provided(client, auth_headers):
    """No amount in body → defaults to 10000."""
    card = _create_user_card(client, auth_headers)
    _add_benefit(client, auth_headers, card["id"], {
        "category": "전체", "benefit_type": "cashback", "rate": 1.0,
    })
    resp = client.post("/api/v1/cards/recommend", headers=auth_headers, json={"merchant_name": "스타벅스"})
    assert resp.status_code == 200
    results = resp.json()
    # 1% of 10000 = 100
    assert results[0]["effective_value"] == 100
