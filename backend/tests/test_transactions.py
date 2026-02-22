# backend/tests/test_transactions.py
"""
Tests for /api/v1/transactions/* endpoints.

Coverage:
  GET    /transactions/              – list (empty, populated, sorted)
  POST   /transactions/              – create (all fields, minimal fields)
  GET    /transactions/{id}          – found, not found, user isolation
  PUT    /transactions/{id}          – partial update
  PATCH  /transactions/{id}/favorite – toggle on / off
  DELETE /transactions/{id}          – success, not found
"""

from tests.conftest import register_and_login

# ── helpers ───────────────────────────────────────────────────────────────────

TX_PAYLOAD = {
    "type": "expense",
    "amount": "10000.00",
    "description": "점심",
    "transacted_at": "2026-01-15T12:00:00+00:00",
}


def create_tx(client, headers, payload=None):
    resp = client.post("/api/v1/transactions/", headers=headers, json=payload or TX_PAYLOAD)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ── list ──────────────────────────────────────────────────────────────────────


def test_list_transactions_initially_empty(client, auth_headers):
    resp = client.get("/api/v1/transactions/", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_transactions_returns_created_transaction(client, auth_headers):
    create_tx(client, auth_headers)
    resp = client.get("/api/v1/transactions/", headers=auth_headers)
    assert len(resp.json()) == 1


def test_list_transactions_sorted_by_transacted_at_desc(client, auth_headers):
    create_tx(client, auth_headers, {**TX_PAYLOAD, "transacted_at": "2026-01-10T00:00:00+00:00"})
    create_tx(client, auth_headers, {**TX_PAYLOAD, "transacted_at": "2026-01-20T00:00:00+00:00"})
    transactions = client.get("/api/v1/transactions/", headers=auth_headers).json()
    assert transactions[0]["transacted_at"] > transactions[1]["transacted_at"]


def test_list_transactions_only_returns_own_data(client, auth_headers):
    """Another user must not see the current user's transactions."""
    create_tx(client, auth_headers)
    headers2 = register_and_login(client, "user2@example.com")
    resp = client.get("/api/v1/transactions/", headers=headers2)
    assert resp.json() == []


# ── create ────────────────────────────────────────────────────────────────────


def test_create_transaction_returns_201_with_all_fields(client, auth_headers):
    resp = client.post("/api/v1/transactions/", headers=auth_headers, json=TX_PAYLOAD)
    assert resp.status_code == 201
    body = resp.json()
    assert body["type"] == "expense"
    assert float(body["amount"]) == 10000.0
    assert body["description"] == "점심"
    assert body["is_favorite"] is False


def test_create_income_transaction(client, auth_headers):
    resp = client.post(
        "/api/v1/transactions/",
        headers=auth_headers,
        json={"type": "income", "amount": "500000", "transacted_at": "2026-01-15T09:00:00+00:00"},
    )
    assert resp.status_code == 201
    assert resp.json()["type"] == "income"


def test_create_transaction_with_payment_type(client, auth_headers):
    resp = client.post(
        "/api/v1/transactions/",
        headers=auth_headers,
        json={**TX_PAYLOAD, "payment_type": "credit_card"},
    )
    assert resp.status_code == 201
    assert resp.json()["payment_type"] == "credit_card"


def test_create_transaction_optional_fields_default_to_none(client, auth_headers):
    resp = client.post(
        "/api/v1/transactions/",
        headers=auth_headers,
        json={"type": "expense", "amount": "5000", "transacted_at": "2026-01-15T12:00:00+00:00"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["description"] is None
    assert body["category_id"] is None
    assert body["payment_type"] is None
    assert body["user_card_id"] is None


# ── get ───────────────────────────────────────────────────────────────────────


def test_get_transaction_by_id(client, auth_headers):
    created = create_tx(client, auth_headers)
    resp = client.get(f"/api/v1/transactions/{created['id']}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


def test_get_transaction_not_found_returns_404(client, auth_headers):
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = client.get(f"/api/v1/transactions/{fake_id}", headers=auth_headers)
    assert resp.status_code == 404


def test_get_transaction_other_user_returns_404(client, auth_headers):
    """User 2 must not be able to read User 1's transaction."""
    created = create_tx(client, auth_headers)
    headers2 = register_and_login(client, "user2@example.com")
    resp = client.get(f"/api/v1/transactions/{created['id']}", headers=headers2)
    assert resp.status_code == 404


# ── update ────────────────────────────────────────────────────────────────────


def test_update_transaction_amount(client, auth_headers):
    created = create_tx(client, auth_headers)
    resp = client.put(
        f"/api/v1/transactions/{created['id']}",
        headers=auth_headers,
        json={"amount": "99000"},
    )
    assert resp.status_code == 200
    assert float(resp.json()["amount"]) == 99000.0


def test_update_transaction_description(client, auth_headers):
    created = create_tx(client, auth_headers)
    resp = client.put(
        f"/api/v1/transactions/{created['id']}",
        headers=auth_headers,
        json={"description": "저녁"},
    )
    assert resp.status_code == 200
    assert resp.json()["description"] == "저녁"


def test_update_transaction_not_found_returns_404(client, auth_headers):
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = client.put(
        f"/api/v1/transactions/{fake_id}",
        headers=auth_headers,
        json={"amount": "100"},
    )
    assert resp.status_code == 404


# ── favorite ──────────────────────────────────────────────────────────────────


def test_toggle_favorite_on(client, auth_headers):
    created = create_tx(client, auth_headers)
    assert created["is_favorite"] is False

    resp = client.patch(
        f"/api/v1/transactions/{created['id']}/favorite",
        headers=auth_headers,
        json={"is_favorite": True},
    )
    assert resp.status_code == 200
    assert resp.json()["is_favorite"] is True


def test_toggle_favorite_off(client, auth_headers):
    created = create_tx(client, auth_headers)
    # First mark as favorite
    client.patch(
        f"/api/v1/transactions/{created['id']}/favorite",
        headers=auth_headers,
        json={"is_favorite": True},
    )
    # Then unmark
    resp = client.patch(
        f"/api/v1/transactions/{created['id']}/favorite",
        headers=auth_headers,
        json={"is_favorite": False},
    )
    assert resp.status_code == 200
    assert resp.json()["is_favorite"] is False


def test_toggle_favorite_other_transaction_unaffected(client, auth_headers):
    """Toggling one transaction must not affect others."""
    tx1 = create_tx(client, auth_headers)
    tx2 = create_tx(client, auth_headers)

    client.patch(
        f"/api/v1/transactions/{tx1['id']}/favorite",
        headers=auth_headers,
        json={"is_favorite": True},
    )

    resp = client.get(f"/api/v1/transactions/{tx2['id']}", headers=auth_headers)
    assert resp.json()["is_favorite"] is False


# ── delete ────────────────────────────────────────────────────────────────────


def test_delete_transaction_returns_204(client, auth_headers):
    created = create_tx(client, auth_headers)
    resp = client.delete(f"/api/v1/transactions/{created['id']}", headers=auth_headers)
    assert resp.status_code == 204
    # Verify it no longer exists
    resp2 = client.get(f"/api/v1/transactions/{created['id']}", headers=auth_headers)
    assert resp2.status_code == 404


def test_delete_transaction_not_found_returns_404(client, auth_headers):
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = client.delete(f"/api/v1/transactions/{fake_id}", headers=auth_headers)
    assert resp.status_code == 404
