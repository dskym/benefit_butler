# backend/tests/test_transactions.py
"""
Tests for /api/v1/transactions/* endpoints.

Coverage:
  GET    /transactions/              – list (empty, populated, sorted)
  GET    /transactions/?card_id=...  – filter by card
  GET    /transactions/?from=...&to= – filter by date range
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


def create_card(client, headers, name="테스트카드"):
    resp = client.post(
        "/api/v1/cards/",
        headers=headers,
        json={"type": "credit_card", "name": name},
    )
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


# ── card_id filter ────────────────────────────────────────────────────────────


def test_filter_by_card_id_returns_only_matching(client, auth_headers):
    card1 = create_card(client, auth_headers, "카드1")
    card2 = create_card(client, auth_headers, "카드2")

    create_tx(client, auth_headers, {**TX_PAYLOAD, "user_card_id": card1["id"]})
    create_tx(client, auth_headers, {**TX_PAYLOAD, "user_card_id": card2["id"]})
    create_tx(client, auth_headers, TX_PAYLOAD)  # no card

    resp = client.get(f"/api/v1/transactions/?card_id={card1['id']}", headers=auth_headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["user_card_id"] == card1["id"]


def test_filter_by_card_id_returns_empty_for_unknown_card(client, auth_headers):
    create_tx(client, auth_headers)
    fake_card_id = "00000000-0000-0000-0000-000000000000"
    resp = client.get(f"/api/v1/transactions/?card_id={fake_card_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_filter_by_card_id_user_isolation(client, auth_headers):
    """User 2 cannot retrieve User 1's card transactions even by guessing the card_id."""
    card = create_card(client, auth_headers)
    create_tx(client, auth_headers, {**TX_PAYLOAD, "user_card_id": card["id"]})
    headers2 = register_and_login(client, "user2@example.com")

    resp = client.get(f"/api/v1/transactions/?card_id={card['id']}", headers=headers2)
    assert resp.json() == []


# ── date range filter ─────────────────────────────────────────────────────────


def test_filter_by_from_date(client, auth_headers):
    create_tx(client, auth_headers, {**TX_PAYLOAD, "transacted_at": "2026-01-10T12:00:00+00:00"})
    create_tx(client, auth_headers, {**TX_PAYLOAD, "transacted_at": "2026-01-20T12:00:00+00:00"})

    resp = client.get("/api/v1/transactions/?from=2026-01-15", headers=auth_headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert "2026-01-20" in items[0]["transacted_at"]


def test_filter_by_to_date(client, auth_headers):
    create_tx(client, auth_headers, {**TX_PAYLOAD, "transacted_at": "2026-01-10T12:00:00+00:00"})
    create_tx(client, auth_headers, {**TX_PAYLOAD, "transacted_at": "2026-01-20T12:00:00+00:00"})

    resp = client.get("/api/v1/transactions/?to=2026-01-15", headers=auth_headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert "2026-01-10" in items[0]["transacted_at"]


def test_filter_by_date_range(client, auth_headers):
    create_tx(client, auth_headers, {**TX_PAYLOAD, "transacted_at": "2026-01-05T12:00:00+00:00"})
    create_tx(client, auth_headers, {**TX_PAYLOAD, "transacted_at": "2026-01-15T12:00:00+00:00"})
    create_tx(client, auth_headers, {**TX_PAYLOAD, "transacted_at": "2026-01-25T12:00:00+00:00"})

    resp = client.get("/api/v1/transactions/?from=2026-01-10&to=2026-01-20", headers=auth_headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert "2026-01-15" in items[0]["transacted_at"]


def test_filter_includes_boundary_dates(client, auth_headers):
    """Transactions on exactly from/to dates must be included."""
    create_tx(client, auth_headers, {**TX_PAYLOAD, "transacted_at": "2026-01-01T00:00:00+00:00"})
    create_tx(client, auth_headers, {**TX_PAYLOAD, "transacted_at": "2026-01-31T23:59:59+00:00"})

    resp = client.get("/api/v1/transactions/?from=2026-01-01&to=2026-01-31", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_filter_by_card_and_date_combined(client, auth_headers):
    card = create_card(client, auth_headers)
    create_tx(client, auth_headers, {**TX_PAYLOAD, "user_card_id": card["id"], "transacted_at": "2026-01-10T12:00:00+00:00"})
    create_tx(client, auth_headers, {**TX_PAYLOAD, "user_card_id": card["id"], "transacted_at": "2026-01-20T12:00:00+00:00"})
    create_tx(client, auth_headers, {**TX_PAYLOAD, "transacted_at": "2026-01-15T12:00:00+00:00"})  # different card

    resp = client.get(
        f"/api/v1/transactions/?card_id={card['id']}&from=2026-01-15",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert "2026-01-20" in items[0]["transacted_at"]


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


# ── edge cases (documents current behavior) ─────────────────────────────────


def test_create_transaction_with_zero_amount(client, auth_headers):
    """amount=0 -- documents current behavior."""
    resp = client.post(
        "/api/v1/transactions/",
        headers=auth_headers,
        json={**TX_PAYLOAD, "amount": "0"},
    )
    # Currently no validation prevents 0 amount
    assert resp.status_code == 201
    assert float(resp.json()["amount"]) == 0.0


def test_create_transaction_with_negative_amount(client, auth_headers):
    """Negative amount -- documents current behavior."""
    resp = client.post(
        "/api/v1/transactions/",
        headers=auth_headers,
        json={**TX_PAYLOAD, "amount": "-5000"},
    )
    assert resp.status_code == 201
    assert float(resp.json()["amount"]) == -5000.0


def test_create_transaction_with_large_amount(client, auth_headers):
    """Very large amount is accepted."""
    resp = client.post(
        "/api/v1/transactions/",
        headers=auth_headers,
        json={**TX_PAYLOAD, "amount": "999999999999"},
    )
    assert resp.status_code == 201


def test_create_transaction_with_invalid_type(client, auth_headers):
    """Invalid type string -- documents current behavior (no enum validation)."""
    resp = client.post(
        "/api/v1/transactions/",
        headers=auth_headers,
        json={**TX_PAYLOAD, "type": "invalid_type"},
    )
    # Currently no validation on type field (plain str); accepted as-is
    assert resp.status_code == 201


def test_filter_from_greater_than_to_returns_empty(client, auth_headers):
    """from > to date range returns empty results."""
    create_tx(client, auth_headers)
    resp = client.get(
        "/api/v1/transactions/?from=2026-12-31&to=2026-01-01",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json() == []


def test_update_transaction_with_empty_body_preserves_data(client, auth_headers):
    """PUT with empty body does not alter existing values."""
    created = create_tx(client, auth_headers)
    resp = client.put(
        f"/api/v1/transactions/{created['id']}",
        headers=auth_headers,
        json={},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert float(body["amount"]) == float(created["amount"])
    assert body["description"] == created["description"]
