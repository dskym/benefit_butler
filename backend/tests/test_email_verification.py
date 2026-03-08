# backend/tests/test_email_verification.py
"""
Tests for email verification endpoints.

Coverage:
  POST /auth/verify-email        – success, wrong code, expired, max attempts, already verified
  POST /auth/resend-verification – success, cooldown, already verified
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, AsyncMock

from sqlalchemy import select

from app.core.database import get_db
from app.models.email_verification import EmailVerification
from app.models.user import User


def _get_latest_code(user_email: str) -> str:
    """DB에서 최신 인증코드를 조회한다."""
    db = next(get_db())
    user = db.scalar(select(User).where(User.email == user_email))
    verification = db.scalar(
        select(EmailVerification)
        .where(EmailVerification.user_id == user.id, EmailVerification.is_used == False)
        .order_by(EmailVerification.created_at.desc())
    )
    return verification.code if verification else None


def _expire_code(user_email: str) -> None:
    """DB에서 최신 인증코드를 만료시킨다."""
    db = next(get_db())
    user = db.scalar(select(User).where(User.email == user_email))
    verification = db.scalar(
        select(EmailVerification)
        .where(EmailVerification.user_id == user.id, EmailVerification.is_used == False)
        .order_by(EmailVerification.created_at.desc())
    )
    if verification:
        verification.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()


def _max_out_attempts(user_email: str) -> None:
    """DB에서 최신 인증코드의 시도 횟수를 5로 설정한다."""
    db = next(get_db())
    user = db.scalar(select(User).where(User.email == user_email))
    verification = db.scalar(
        select(EmailVerification)
        .where(EmailVerification.user_id == user.id, EmailVerification.is_used == False)
        .order_by(EmailVerification.created_at.desc())
    )
    if verification:
        verification.attempts = 5
        db.commit()


def _clear_cooldown(user_email: str) -> None:
    """재발송 쿨다운을 우회하기 위해 기존 코드의 created_at을 과거로 변경."""
    db = next(get_db())
    user = db.scalar(select(User).where(User.email == user_email))
    verifications = db.scalars(
        select(EmailVerification).where(EmailVerification.user_id == user.id)
    ).all()
    for v in verifications:
        v.created_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    db.commit()


def _register_and_get_headers(client, email="verify@example.com"):
    """가입 후 미인증 상태의 auth headers 반환."""
    with patch("app.api.v1.endpoints.auth.create_and_send_verification", new_callable=AsyncMock):
        client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "password123", "name": "Verifier"},
        )
    # 가입 시 create_and_send_verification을 mock했으므로 수동으로 코드 생성
    db = next(get_db())
    user = db.scalar(select(User).where(User.email == email))
    verification = EmailVerification(
        user_id=user.id,
        code="123456",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db.add(verification)
    db.commit()

    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password123"},
    )
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


# ── verify-email ─────────────────────────────────────────────────────────────


def test_verify_email_success(client):
    headers = _register_and_get_headers(client)
    resp = client.post("/api/v1/auth/verify-email", json={"code": "123456"}, headers=headers)
    assert resp.status_code == 200
    assert "완료" in resp.json()["message"]

    # /me에서 is_email_verified 확인
    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.json()["is_email_verified"] is True


def test_verify_email_wrong_code(client):
    headers = _register_and_get_headers(client)
    resp = client.post("/api/v1/auth/verify-email", json={"code": "000000"}, headers=headers)
    assert resp.status_code == 400
    assert "올바르지 않습니다" in resp.json()["detail"]


def test_verify_email_expired_code(client):
    headers = _register_and_get_headers(client)
    _expire_code("verify@example.com")
    resp = client.post("/api/v1/auth/verify-email", json={"code": "123456"}, headers=headers)
    assert resp.status_code == 400
    assert "만료" in resp.json()["detail"]


def test_verify_email_max_attempts(client):
    headers = _register_and_get_headers(client)
    _max_out_attempts("verify@example.com")
    resp = client.post("/api/v1/auth/verify-email", json={"code": "123456"}, headers=headers)
    assert resp.status_code == 400
    assert "시도 횟수" in resp.json()["detail"]


def test_verify_email_already_verified(client):
    headers = _register_and_get_headers(client)
    client.post("/api/v1/auth/verify-email", json={"code": "123456"}, headers=headers)
    resp = client.post("/api/v1/auth/verify-email", json={"code": "123456"}, headers=headers)
    assert resp.status_code == 400
    assert "이미 인증" in resp.json()["detail"]


# ── resend-verification ──────────────────────────────────────────────────────


def test_resend_verification_success(client):
    headers = _register_and_get_headers(client)
    _clear_cooldown("verify@example.com")

    with patch("app.services.verification.get_email_service") as mock_svc:
        mock_svc.return_value.send = AsyncMock()
        resp = client.post("/api/v1/auth/resend-verification", headers=headers)

    assert resp.status_code == 200
    assert "재발송" in resp.json()["message"]


def test_resend_verification_cooldown(client):
    headers = _register_and_get_headers(client)
    # 쿨다운 내 재발송 시도 — 코드가 방금 생성되었으므로 429
    resp = client.post("/api/v1/auth/resend-verification", headers=headers)
    assert resp.status_code == 429
    assert "초 후" in resp.json()["detail"]


def test_resend_verification_already_verified(client):
    headers = _register_and_get_headers(client)
    client.post("/api/v1/auth/verify-email", json={"code": "123456"}, headers=headers)
    resp = client.post("/api/v1/auth/resend-verification", headers=headers)
    assert resp.status_code == 400
    assert "이미 인증" in resp.json()["detail"]
