# backend/tests/test_cards.py
"""
Tests for /api/v1/cards/* endpoints.

Coverage:
  GET    /cards/       – list (empty, populated, sorted by created_at asc)
  POST   /cards/       – create credit card, debit card
  PATCH  /cards/{id}   – set monthly_target, clear to None
  DELETE /cards/{id}   – success, not found, user isolation
"""

from tests.conftest import register_and_login

# ── helpers ───────────────────────────────────────────────────────────────────

CREDIT_CARD_PAYLOAD = {"type": "credit_card", "name": "신한카드"}
DEBIT_CARD_PAYLOAD = {"type": "debit_card", "name": "카카오뱅크"}


def create_card(client, headers, payload=None):
    resp = client.post("/api/v1/cards/", headers=headers, json=payload or CREDIT_CARD_PAYLOAD)
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


def test_create_debit_card_returns_201(client, auth_headers):
    resp = client.post("/api/v1/cards/", headers=auth_headers, json=DEBIT_CARD_PAYLOAD)
    assert resp.status_code == 201
    assert resp.json()["type"] == "debit_card"


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
