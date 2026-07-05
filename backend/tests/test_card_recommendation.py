# backend/tests/test_card_recommendation.py
"""POST /api/v1/cards/recommend — 추천 엔진 테스트.

Coverage:
  - 매칭 계층: 가맹점 > 카테고리 > 전체 (동가치 tie-break 포함)
  - 가맹점명 서버 resolve 경로 / merchant_id 직접 전달 경로
  - category 수동 오버라이드 / 구 클라이언트 "전체" 호환
  - requires_performance: 전월실적 미달 스킵 + 무실적 혜택 폴백, 목표 미설정=충족
  - min_amount / monthly_cap / effective_value 정렬
  - 사용자 격리 / 인증 / 422
"""
from datetime import date, timedelta

from tests.conftest import register_and_login

# ── helpers ───────────────────────────────────────────────────────────────────


def _create_user_card(client, headers, payload=None):
    resp = client.post(
        "/api/v1/cards/", headers=headers, json=payload or {"type": "credit_card", "name": "내카드"}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _add_benefit(client, headers, card_id, payload):
    resp = client.post(f"/api/v1/cards/{card_id}/benefits", headers=headers, json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _recommend(client, headers, amount=10000, merchant_name=None, merchant_id=None, category=None):
    body = {"amount": amount}
    if merchant_name is not None:
        body["merchant_name"] = merchant_name
    if merchant_id is not None:
        body["merchant_id"] = merchant_id
    if category is not None:
        body["category"] = category
    resp = client.post("/api/v1/cards/recommend", headers=headers, json=body)
    assert resp.status_code == 200, resp.text
    return resp.json()


def _prev_month_ts():
    """직전 실적기간(billing_day 미설정 → 전월) 중간 시점의 ISO timestamp."""
    d = date.today().replace(day=1) - timedelta(days=15)
    return f"{d.isoformat()}T12:00:00+00:00"


def _create_tx(client, headers, card_id, amount, transacted_at):
    resp = client.post(
        "/api/v1/transactions/",
        headers=headers,
        json={"type": "expense", "amount": str(amount), "transacted_at": transacted_at, "user_card_id": card_id},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ── 기본 동작 ─────────────────────────────────────────────────────────────────


def test_recommend_no_cards_returns_empty(client, auth_headers):
    body = _recommend(client, auth_headers, merchant_name="스타벅스")
    assert body["results"] == []
    assert body["resolved"]["source"] == "none"  # 사전 미시드 → 미해석


def test_recommend_card_without_benefits_excluded(client, auth_headers):
    _create_user_card(client, auth_headers)
    body = _recommend(client, auth_headers, category="식비")
    assert body["results"] == []


def test_recommend_category_match(client, auth_headers):
    card = _create_user_card(client, auth_headers)
    _add_benefit(client, auth_headers, card["id"], {
        "target_type": "category", "category": "식비", "benefit_type": "cashback", "rate": 3.0,
    })
    body = _recommend(client, auth_headers, amount=10000, category="식비")
    assert len(body["results"]) == 1
    item = body["results"][0]
    assert item["card_id"] == card["id"]
    assert item["matched_by"] == "category"
    assert item["effective_value"] == 300


def test_recommend_all_benefit_applies_to_any_category(client, auth_headers):
    card = _create_user_card(client, auth_headers)
    _add_benefit(client, auth_headers, card["id"], {
        "target_type": "all", "benefit_type": "cashback", "rate": 1.5,
    })
    body = _recommend(client, auth_headers, amount=10000, category="쇼핑")
    assert len(body["results"]) == 1
    assert body["results"][0]["matched_by"] == "all"
    assert body["results"][0]["effective_value"] == 150


def test_recommend_no_category_only_all_matches(client, auth_headers):
    card = _create_user_card(client, auth_headers)
    _add_benefit(client, auth_headers, card["id"], {
        "target_type": "category", "category": "식비", "benefit_type": "cashback", "rate": 5.0,
    })
    _add_benefit(client, auth_headers, card["id"], {
        "target_type": "all", "benefit_type": "cashback", "rate": 1.0,
    })
    body = _recommend(client, auth_headers, amount=10000)  # 카테고리/가맹점 없음
    assert len(body["results"]) == 1
    assert body["results"][0]["matched_by"] == "all"
    assert body["results"][0]["effective_value"] == 100


def test_recommend_legacy_jeonche_category_treated_as_none(client, auth_headers):
    """구 클라이언트가 category='전체'를 보내면 오버라이드 없음으로 처리."""
    card = _create_user_card(client, auth_headers)
    _add_benefit(client, auth_headers, card["id"], {
        "category": "전체", "benefit_type": "cashback", "rate": 1.0,  # 구 payload 형식
    })
    body = _recommend(client, auth_headers, amount=20000, category="전체")
    assert len(body["results"]) == 1
    assert body["results"][0]["effective_value"] == 200


# ── 가맹점 매칭 ───────────────────────────────────────────────────────────────


def test_recommend_merchant_match_via_server_resolve(client, auth_headers):
    card = _create_user_card(client, auth_headers)
    _add_benefit(client, auth_headers, card["id"], {
        "target_type": "merchant", "merchant_names": ["스타벅스"],
        "benefit_type": "cashback", "rate": 10.0,
    })
    body = _recommend(client, auth_headers, amount=10000, merchant_name="스타벅스 강남점")
    assert body["resolved"]["merchant_name"] == "스타벅스"
    assert body["resolved"]["source"] in ("alias", "partial")
    assert len(body["results"]) == 1
    item = body["results"][0]
    assert item["matched_by"] == "merchant"
    assert item["effective_value"] == 1000


def test_recommend_merchant_id_direct(client, auth_headers):
    card = _create_user_card(client, auth_headers)
    _add_benefit(client, auth_headers, card["id"], {
        "target_type": "merchant", "merchant_names": ["쿠팡"],
        "benefit_type": "cashback", "rate": 5.0,
    })
    lookup = client.get("/api/v1/merchants/lookup?q=쿠팡", headers=auth_headers).json()
    assert lookup["merchant_id"] is not None
    body = _recommend(client, auth_headers, amount=10000, merchant_id=lookup["merchant_id"])
    assert len(body["results"]) == 1
    assert body["results"][0]["matched_by"] == "merchant"
    assert body["resolved"]["merchant_id"] == lookup["merchant_id"]


def test_recommend_merchant_resolve_supplies_category(client, auth_headers):
    """가맹점 resolve로 얻은 카테고리로 카테고리 혜택도 함께 매칭된다."""
    card = _create_user_card(client, auth_headers)
    # 가맹점 혜택을 가진 다른 카드로 '스타벅스'(식비) 가맹점을 사전에 등록
    other = _create_user_card(client, auth_headers, {"type": "credit_card", "name": "등록용"})
    _add_benefit(client, auth_headers, other["id"], {
        "target_type": "merchant", "merchant_names": ["스타벅스"],
        "benefit_type": "cashback", "rate": 0.1,
    })
    # 등록용 가맹점 혜택의 default 카테고리는 category=None → "쇼핑"이므로 쇼핑 카테고리 혜택 준비
    _add_benefit(client, auth_headers, card["id"], {
        "target_type": "category", "category": "쇼핑", "benefit_type": "cashback", "rate": 3.0,
    })
    body = _recommend(client, auth_headers, amount=10000, merchant_name="스타벅스")
    assert body["resolved"]["category"] == "쇼핑"
    by_card = {r["card_id"]: r for r in body["results"]}
    assert by_card[card["id"]]["matched_by"] == "category"


def test_recommend_merchant_tier_beats_category_on_tie(client, auth_headers):
    """같은 가치면 가맹점 타겟 혜택이 카테고리 혜택보다 우선."""
    card = _create_user_card(client, auth_headers)
    _add_benefit(client, auth_headers, card["id"], {
        "target_type": "category", "category": "쇼핑", "benefit_type": "cashback", "rate": 5.0,
    })
    _add_benefit(client, auth_headers, card["id"], {
        "target_type": "merchant", "merchant_names": ["쿠팡"],
        "benefit_type": "cashback", "rate": 5.0,
    })
    body = _recommend(client, auth_headers, amount=10000, merchant_name="쿠팡")
    assert len(body["results"]) == 1
    assert body["results"][0]["matched_by"] == "merchant"


def test_recommend_sorted_by_effective_value(client, auth_headers):
    low = _create_user_card(client, auth_headers, {"type": "credit_card", "name": "저혜택"})
    high = _create_user_card(client, auth_headers, {"type": "credit_card", "name": "고혜택"})
    _add_benefit(client, auth_headers, low["id"], {
        "target_type": "category", "category": "식비", "benefit_type": "cashback", "rate": 1.0,
    })
    _add_benefit(client, auth_headers, high["id"], {
        "target_type": "merchant", "merchant_names": ["스타벅스"],
        "benefit_type": "cashback", "rate": 50.0, "monthly_cap": 10000,
    })
    # 스타벅스는 위 혜택 생성으로 가맹점 사전에 등록됨 (default 카테고리 식비 아님 주의 — 쇼핑)
    body = _recommend(client, auth_headers, amount=10000, merchant_name="스타벅스", category="식비")
    assert [r["card_name"] for r in body["results"]] == ["고혜택", "저혜택"]
    assert body["results"][0]["effective_value"] == 5000
    assert body["results"][1]["effective_value"] == 100


def test_recommend_category_override_wins_over_resolved(client, auth_headers):
    card = _create_user_card(client, auth_headers)
    _add_benefit(client, auth_headers, card["id"], {
        "target_type": "category", "category": "여행", "benefit_type": "cashback", "rate": 2.0,
    })
    # merchant_name은 미해석("없는가게") → category 오버라이드만 적용
    body = _recommend(client, auth_headers, amount=10000, merchant_name="없는가게", category="여행")
    assert len(body["results"]) == 1
    assert body["results"][0]["matched_by"] == "category"


# ── 조건: min_amount / monthly_cap ────────────────────────────────────────────


def test_recommend_min_amount_excludes_benefit(client, auth_headers):
    card = _create_user_card(client, auth_headers)
    _add_benefit(client, auth_headers, card["id"], {
        "target_type": "category", "category": "식비", "benefit_type": "cashback",
        "rate": 10.0, "min_amount": 30000,
    })
    body = _recommend(client, auth_headers, amount=10000, category="식비")
    assert body["results"] == []
    body = _recommend(client, auth_headers, amount=30000, category="식비")
    assert len(body["results"]) == 1


def test_recommend_monthly_cap_caps_value(client, auth_headers):
    card = _create_user_card(client, auth_headers)
    _add_benefit(client, auth_headers, card["id"], {
        "target_type": "category", "category": "쇼핑", "benefit_type": "cashback",
        "rate": 10.0, "monthly_cap": 5000,
    })
    body = _recommend(client, auth_headers, amount=100000, category="쇼핑")
    assert body["results"][0]["effective_value"] == 5000  # 10000이 아니라 cap


def test_recommend_flat_amount_benefit(client, auth_headers):
    card = _create_user_card(client, auth_headers)
    _add_benefit(client, auth_headers, card["id"], {
        "target_type": "category", "category": "문화/여가", "benefit_type": "discount",
        "flat_amount": 3000, "min_amount": 10000,
    })
    body = _recommend(client, auth_headers, amount=15000, category="문화/여가")
    assert body["results"][0]["effective_value"] == 3000
    assert body["results"][0]["benefit_type"] == "discount"


# ── 전월실적 조건 ─────────────────────────────────────────────────────────────


def test_requires_performance_skipped_when_unmet(client, auth_headers):
    """전월실적 미달이면 해당 혜택은 스킵되고 무실적 혜택으로 폴백."""
    card = _create_user_card(
        client, auth_headers, {"type": "credit_card", "name": "실적카드", "monthly_target": 300000}
    )
    _add_benefit(client, auth_headers, card["id"], {
        "target_type": "category", "category": "식비", "benefit_type": "cashback",
        "rate": 10.0, "requires_performance": True,
    })
    _add_benefit(client, auth_headers, card["id"], {
        "target_type": "all", "benefit_type": "cashback", "rate": 0.5,
    })
    body = _recommend(client, auth_headers, amount=10000, category="식비")
    assert len(body["results"]) == 1
    item = body["results"][0]
    assert item["matched_by"] == "all"  # 10% 혜택 스킵 → 기본 0.5%
    assert item["effective_value"] == 50
    assert item["performance_required"] is False
    assert item["performance_met"] is False


def test_requires_performance_applied_when_met(client, auth_headers):
    card = _create_user_card(
        client, auth_headers, {"type": "credit_card", "name": "실적카드", "monthly_target": 300000}
    )
    _create_tx(client, auth_headers, card["id"], 300000, _prev_month_ts())  # 전월 실적 충족
    _add_benefit(client, auth_headers, card["id"], {
        "target_type": "category", "category": "식비", "benefit_type": "cashback",
        "rate": 10.0, "requires_performance": True,
    })
    body = _recommend(client, auth_headers, amount=10000, category="식비")
    assert len(body["results"]) == 1
    item = body["results"][0]
    assert item["effective_value"] == 1000
    assert item["performance_required"] is True
    assert item["performance_met"] is True


def test_requires_performance_no_target_treated_as_met(client, auth_headers):
    """monthly_target 미설정 카드는 실적 조건 혜택도 적용 (performance_met=None)."""
    card = _create_user_card(client, auth_headers)
    _add_benefit(client, auth_headers, card["id"], {
        "target_type": "category", "category": "식비", "benefit_type": "cashback",
        "rate": 10.0, "requires_performance": True,
    })
    body = _recommend(client, auth_headers, amount=10000, category="식비")
    assert len(body["results"]) == 1
    assert body["results"][0]["effective_value"] == 1000
    assert body["results"][0]["performance_met"] is None


# ── 인증/격리/검증 ────────────────────────────────────────────────────────────


def test_recommend_user_isolation(client, auth_headers):
    card = _create_user_card(client, auth_headers)
    _add_benefit(client, auth_headers, card["id"], {
        "target_type": "all", "benefit_type": "cashback", "rate": 1.0,
    })
    headers2 = register_and_login(client, "other@example.com")
    body = _recommend(client, headers2, amount=10000)
    assert body["results"] == []


def test_recommend_requires_auth(client):
    resp = client.post("/api/v1/cards/recommend", json={"amount": 10000})
    assert resp.status_code in (401, 403)


def test_recommend_rejects_non_positive_amount(client, auth_headers):
    resp = client.post("/api/v1/cards/recommend", headers=auth_headers, json={"amount": 0})
    assert resp.status_code == 422
    resp = client.post("/api/v1/cards/recommend", headers=auth_headers, json={"amount": -100})
    assert resp.status_code == 422


def test_recommend_requires_amount(client, auth_headers):
    resp = client.post("/api/v1/cards/recommend", headers=auth_headers, json={"merchant_name": "스타벅스"})
    assert resp.status_code == 422
