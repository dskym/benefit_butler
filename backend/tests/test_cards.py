# backend/tests/test_cards.py
"""
Tests for /api/v1/cards/* endpoints.

Coverage:
  GET    /cards/              – list (empty, populated, sorted by created_at asc)
  POST   /cards/              – create credit card, debit card; with/without billing_day
  PATCH  /cards/{id}          – set monthly_target, billing_day, clear to None
  DELETE /cards/{id}          – success, not found, user isolation
  GET    /cards/performance   – no cards, billing_day null, billing_day set, target null
"""

from tests.conftest import register_and_login

# ── helpers ───────────────────────────────────────────────────────────────────

CREDIT_CARD_PAYLOAD = {"type": "credit_card", "name": "신한카드"}
DEBIT_CARD_PAYLOAD = {"type": "debit_card", "name": "카카오뱅크"}


def create_card(client, headers, payload=None):
    resp = client.post("/api/v1/cards/", headers=headers, json=payload or CREDIT_CARD_PAYLOAD)
    assert resp.status_code == 201, resp.text
    return resp.json()


def create_tx(client, headers, card_id, amount="50000", transacted_at="2026-02-15T12:00:00+00:00"):
    payload = {
        "type": "expense",
        "amount": amount,
        "transacted_at": transacted_at,
        "user_card_id": card_id,
    }
    resp = client.post("/api/v1/transactions/", headers=headers, json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ── list ──────────────────────────────────────────────────────────────────────


def test_list_cards_initially_empty(client, auth_headers):
    resp = client.get("/api/v1/cards/", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_cards_returns_created_cards(client, auth_headers):
    create_card(client, auth_headers, CREDIT_CARD_PAYLOAD)
    create_card(client, auth_headers, DEBIT_CARD_PAYLOAD)
    resp = client.get("/api/v1/cards/", headers=auth_headers)
    assert len(resp.json()) == 2


def test_list_cards_only_returns_own_cards(client, auth_headers):
    """Another user's cards must not appear in the list."""
    create_card(client, auth_headers)
    headers2 = register_and_login(client, "user2@example.com")
    resp = client.get("/api/v1/cards/", headers=headers2)
    assert resp.json() == []


# ── create ────────────────────────────────────────────────────────────────────


def test_create_credit_card_returns_201(client, auth_headers):
    resp = client.post("/api/v1/cards/", headers=auth_headers, json=CREDIT_CARD_PAYLOAD)
    assert resp.status_code == 201
    body = resp.json()
    assert body["type"] == "credit_card"
    assert body["name"] == "신한카드"
    assert body["monthly_target"] is None
    assert body["billing_day"] is None


def test_create_debit_card_returns_201(client, auth_headers):
    resp = client.post("/api/v1/cards/", headers=auth_headers, json=DEBIT_CARD_PAYLOAD)
    assert resp.status_code == 201
    assert resp.json()["type"] == "debit_card"


def test_create_card_with_monthly_target_and_billing_day(client, auth_headers):
    resp = client.post(
        "/api/v1/cards/",
        headers=auth_headers,
        json={"type": "credit_card", "name": "KB카드", "monthly_target": 300000, "billing_day": 14},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["monthly_target"] == 300000
    assert body["billing_day"] == 14


# ── update ────────────────────────────────────────────────────────────────────


def test_update_card_sets_monthly_target(client, auth_headers):
    created = create_card(client, auth_headers)
    resp = client.patch(
        f"/api/v1/cards/{created['id']}",
        headers=auth_headers,
        json={"monthly_target": 500000},
    )
    assert resp.status_code == 200
    assert resp.json()["monthly_target"] == 500000


def test_update_card_sets_billing_day(client, auth_headers):
    created = create_card(client, auth_headers)
    resp = client.patch(
        f"/api/v1/cards/{created['id']}",
        headers=auth_headers,
        json={"monthly_target": 300000, "billing_day": 10},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["monthly_target"] == 300000
    assert body["billing_day"] == 10


def test_update_card_clears_monthly_target_to_none(client, auth_headers):
    created = create_card(client, auth_headers)
    # First set a target
    client.patch(
        f"/api/v1/cards/{created['id']}",
        headers=auth_headers,
        json={"monthly_target": 300000},
    )
    # Then clear it
    resp = client.patch(
        f"/api/v1/cards/{created['id']}",
        headers=auth_headers,
        json={"monthly_target": None},
    )
    assert resp.status_code == 200
    assert resp.json()["monthly_target"] is None


def test_update_card_not_found_returns_404(client, auth_headers):
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = client.patch(
        f"/api/v1/cards/{fake_id}",
        headers=auth_headers,
        json={"monthly_target": 100000},
    )
    assert resp.status_code == 404


def test_update_card_other_user_returns_404(client, auth_headers):
    """User 2 must not be able to update User 1's card."""
    created = create_card(client, auth_headers)
    headers2 = register_and_login(client, "user2@example.com")
    resp = client.patch(
        f"/api/v1/cards/{created['id']}",
        headers=headers2,
        json={"monthly_target": 999999},
    )
    assert resp.status_code == 404


# ── delete ────────────────────────────────────────────────────────────────────


def test_delete_card_returns_204(client, auth_headers):
    created = create_card(client, auth_headers)
    resp = client.delete(f"/api/v1/cards/{created['id']}", headers=auth_headers)
    assert resp.status_code == 204
    # Verify it no longer appears in the list
    cards = client.get("/api/v1/cards/", headers=auth_headers).json()
    assert all(c["id"] != created["id"] for c in cards)


def test_delete_card_not_found_returns_404(client, auth_headers):
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = client.delete(f"/api/v1/cards/{fake_id}", headers=auth_headers)
    assert resp.status_code == 404


def test_delete_card_other_user_returns_404(client, auth_headers):
    """User 2 must not be able to delete User 1's card."""
    created = create_card(client, auth_headers)
    headers2 = register_and_login(client, "user2@example.com")
    resp = client.delete(f"/api/v1/cards/{created['id']}", headers=headers2)
    assert resp.status_code == 404


# ── performance ───────────────────────────────────────────────────────────────


def test_performance_no_cards_returns_empty(client, auth_headers):
    resp = client.get("/api/v1/cards/performance", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_performance_card_with_null_billing_day(client, auth_headers):
    """Card with billing_day=None uses calendar month; spending is aggregated."""
    card = create_card(client, auth_headers, {"type": "credit_card", "name": "테스트카드"})

    # Set monthly_target
    client.patch(
        f"/api/v1/cards/{card['id']}",
        headers=auth_headers,
        json={"monthly_target": 300000, "billing_day": None},
    )

    resp = client.get("/api/v1/cards/performance", headers=auth_headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    item = items[0]
    assert item["card_id"] == card["id"]
    assert item["monthly_target"] == 300000
    assert item["billing_day"] is None
    assert item["current_spending"] == 0
    assert item["remaining"] == 300000
    assert item["achievement_percent"] == 0.0
    # period_start should be the first of current month
    assert item["period_start"].endswith("-01") or item["period_start"][8:10] == "01"


def test_performance_card_with_billing_day(client, auth_headers):
    """Card with billing_day=14 uses calendar month window (offset=0)."""
    card = client.post(
        "/api/v1/cards/",
        headers=auth_headers,
        json={"type": "credit_card", "name": "KB카드", "monthly_target": 200000, "billing_day": 14},
    ).json()

    resp = client.get("/api/v1/cards/performance", headers=auth_headers)
    assert resp.status_code == 200
    item = resp.json()[0]
    assert item["billing_day"] == 14
    assert item["achievement_percent"] == 0.0


def test_performance_with_spending_aggregation(client, auth_headers):
    """Spending within the current period is summed correctly."""
    from datetime import date, timedelta

    card = create_card(client, auth_headers, {"type": "credit_card", "name": "지출카드"})
    client.patch(
        f"/api/v1/cards/{card['id']}",
        headers=auth_headers,
        json={"monthly_target": 100000, "billing_day": None},
    )

    # Add two expenses with this card in current month
    today = date.today()
    mid_month = today.replace(day=min(today.day, 15))
    create_tx(client, auth_headers, card["id"], "30000", f"{mid_month}T10:00:00+00:00")
    create_tx(client, auth_headers, card["id"], "20000", f"{mid_month}T11:00:00+00:00")

    resp = client.get("/api/v1/cards/performance", headers=auth_headers)
    item = resp.json()[0]
    assert item["current_spending"] == 50000
    assert item["remaining"] == 50000
    assert item["achievement_percent"] == 50.0


def test_performance_null_target(client, auth_headers):
    """Card without monthly_target: remaining and achievement_percent are None."""
    create_card(client, auth_headers, {"type": "credit_card", "name": "목표없음카드"})

    resp = client.get("/api/v1/cards/performance", headers=auth_headers)
    item = resp.json()[0]
    assert item["monthly_target"] is None
    assert item["remaining"] is None
    assert item["achievement_percent"] is None


def test_performance_user_isolation(client, auth_headers):
    """User 2's performance must not include User 1's cards."""
    create_card(client, auth_headers)
    headers2 = register_and_login(client, "user2@example.com")
    resp = client.get("/api/v1/cards/performance", headers=headers2)
    assert resp.json() == []
