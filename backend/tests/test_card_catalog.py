# backend/tests/test_card_catalog.py
"""
Tests for:
  GET  /api/v1/cards/catalog/           — list (empty DB when no seeds, with search)
  GET  /api/v1/cards/catalog/{id}/      — detail + 404

  GET    /api/v1/cards/{id}/benefits    — list benefits
  POST   /api/v1/cards/{id}/benefits    — create benefit
  PATCH  /api/v1/cards/{id}/benefits/{bid} — update benefit
  DELETE /api/v1/cards/{id}/benefits/{bid} — delete benefit
  (auth/isolation errors for benefit endpoints)
"""

from tests.conftest import register_and_login


# ── helpers ───────────────────────────────────────────────────────────────────

def _create_catalog_card(client):
    """Insert a catalog card directly via DB helper (bypasses auth)."""
    from app.core.database import engine
    import sqlalchemy as sa
    import uuid

    catalog_id = str(uuid.uuid4())
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO card_catalog (id, name, issuer, card_type, is_active, created_at) "
                "VALUES (:id, :name, :issuer, :card_type, :is_active, NOW())"
            ),
            {"id": catalog_id, "name": "테스트 카드", "issuer": "테스트카드사", "card_type": "credit_card", "is_active": True},
        )
    return catalog_id


def _create_user_card(client, headers, payload=None):
    resp = client.post("/api/v1/cards/", headers=headers, json=payload or {"type": "credit_card", "name": "내카드"})
    assert resp.status_code == 201, resp.text
    return resp.json()


BENEFIT_PAYLOAD = {
    "category": "식비",
    "benefit_type": "cashback",
    "rate": 3.0,
    "monthly_cap": 10000,
}


# ── catalog list ──────────────────────────────────────────────────────────────


def test_catalog_list_returns_200(client):
    resp = client.get("/api/v1/cards/catalog/")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_catalog_list_search_by_name(client):
    _create_catalog_card(client)
    resp = client.get("/api/v1/cards/catalog/?q=테스트")
    assert resp.status_code == 200
    assert any("테스트" in c["name"] for c in resp.json())


def test_catalog_list_search_no_match(client):
    resp = client.get("/api/v1/cards/catalog/?q=존재하지않는카드이름xyz")
    assert resp.status_code == 200
    assert resp.json() == []


def test_catalog_list_inactive_card_excluded(client):
    from app.core.database import engine
    import sqlalchemy as sa
    import uuid

    inactive_id = str(uuid.uuid4())
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO card_catalog (id, name, issuer, card_type, is_active, created_at) "
                "VALUES (:id, 'inactive_card_xyz', '테스트', 'credit_card', false, NOW())"
            ),
            {"id": inactive_id},
        )
    resp = client.get("/api/v1/cards/catalog/?q=inactive_card_xyz")
    assert resp.status_code == 200
    assert resp.json() == []


# ── catalog detail ────────────────────────────────────────────────────────────


def test_catalog_detail_returns_200(client):
    catalog_id = _create_catalog_card(client)
    resp = client.get(f"/api/v1/cards/catalog/{catalog_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == catalog_id
    assert body["name"] == "테스트 카드"
    assert body["issuer"] == "테스트카드사"


def test_catalog_detail_not_found_returns_404(client):
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = client.get(f"/api/v1/cards/catalog/{fake_id}")
    assert resp.status_code == 404


# ── benefit CRUD ──────────────────────────────────────────────────────────────


def test_list_benefits_empty(client, auth_headers):
    card = _create_user_card(client, auth_headers)
    resp = client.get(f"/api/v1/cards/{card['id']}/benefits", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_benefit_returns_201(client, auth_headers):
    card = _create_user_card(client, auth_headers)
    resp = client.post(f"/api/v1/cards/{card['id']}/benefits", headers=auth_headers, json=BENEFIT_PAYLOAD)
    assert resp.status_code == 201
    body = resp.json()
    assert body["category"] == "식비"
    assert body["benefit_type"] == "cashback"
    assert body["rate"] == 3.0
    assert body["monthly_cap"] == 10000


def test_list_benefits_after_create(client, auth_headers):
    card = _create_user_card(client, auth_headers)
    client.post(f"/api/v1/cards/{card['id']}/benefits", headers=auth_headers, json=BENEFIT_PAYLOAD)
    resp = client.get(f"/api/v1/cards/{card['id']}/benefits", headers=auth_headers)
    assert len(resp.json()) == 1


def test_update_benefit_changes_rate(client, auth_headers):
    card = _create_user_card(client, auth_headers)
    benefit = client.post(
        f"/api/v1/cards/{card['id']}/benefits", headers=auth_headers, json=BENEFIT_PAYLOAD
    ).json()
    resp = client.patch(
        f"/api/v1/cards/{card['id']}/benefits/{benefit['id']}",
        headers=auth_headers,
        json={"rate": 5.0},
    )
    assert resp.status_code == 200
    assert resp.json()["rate"] == 5.0
    # Unchanged fields remain
    assert resp.json()["category"] == "식비"


def test_delete_benefit_returns_204(client, auth_headers):
    card = _create_user_card(client, auth_headers)
    benefit = client.post(
        f"/api/v1/cards/{card['id']}/benefits", headers=auth_headers, json=BENEFIT_PAYLOAD
    ).json()
    resp = client.delete(
        f"/api/v1/cards/{card['id']}/benefits/{benefit['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 204
    remaining = client.get(f"/api/v1/cards/{card['id']}/benefits", headers=auth_headers).json()
    assert remaining == []


def test_benefit_on_other_users_card_returns_404(client, auth_headers):
    card = _create_user_card(client, auth_headers)
    headers2 = register_and_login(client, "other@example.com")
    # Attempting to list another user's card benefits
    resp = client.get(f"/api/v1/cards/{card['id']}/benefits", headers=headers2)
    assert resp.status_code == 404


def test_benefit_on_nonexistent_card_returns_404(client, auth_headers):
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = client.post(f"/api/v1/cards/{fake_id}/benefits", headers=auth_headers, json=BENEFIT_PAYLOAD)
    assert resp.status_code == 404


def test_update_nonexistent_benefit_returns_404(client, auth_headers):
    card = _create_user_card(client, auth_headers)
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = client.patch(
        f"/api/v1/cards/{card['id']}/benefits/{fake_id}",
        headers=auth_headers,
        json={"rate": 5.0},
    )
    assert resp.status_code == 404


def test_delete_nonexistent_benefit_returns_404(client, auth_headers):
    card = _create_user_card(client, auth_headers)
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = client.delete(
        f"/api/v1/cards/{card['id']}/benefits/{fake_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_benefit_requires_auth(client):
    resp = client.get("/api/v1/cards/00000000-0000-0000-0000-000000000000/benefits")
    assert resp.status_code in (401, 403)
