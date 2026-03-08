# backend/app/services/verification.py
import random
import string
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.email_verification import EmailVerification
from app.models.user import User
from app.services.email import get_email_service

VERIFY_CODE_LENGTH = 6
VERIFY_CODE_EXPIRY_MINUTES = 10
VERIFY_MAX_ATTEMPTS = 5
RESEND_COOLDOWN_SECONDS = 300


def _generate_code() -> str:
    return "".join(random.choices(string.digits, k=VERIFY_CODE_LENGTH))


def _build_verification_email_html(code: str) -> str:
    return f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #191F28; margin-bottom: 24px;">이메일 인증</h2>
        <p style="color: #6B7684; font-size: 14px;">아래 인증코드를 앱에서 입력해주세요.</p>
        <div style="background: #F8F9FA; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #3182F6;">{code}</span>
        </div>
        <p style="color: #B0B8C1; font-size: 13px;">이 코드는 10분간 유효합니다.</p>
    </div>
    """


async def create_and_send_verification(db: Session, user: User) -> None:
    """인증코드를 생성하고 이메일을 발송한다. 기존 미사용 코드는 무효화."""
    if user.is_email_verified:
        raise HTTPException(status_code=400, detail="이미 인증된 이메일입니다")

    # 재발송 쿨다운 체크
    latest = db.scalar(
        select(EmailVerification)
        .where(EmailVerification.user_id == user.id, EmailVerification.is_used == False)
        .order_by(EmailVerification.created_at.desc())
    )
    if latest:
        elapsed = (datetime.now(timezone.utc) - latest.created_at).total_seconds()
        if elapsed < RESEND_COOLDOWN_SECONDS:
            remaining = int(RESEND_COOLDOWN_SECONDS - elapsed)
            raise HTTPException(status_code=429, detail=f"{remaining}초 후 다시 시도해주세요")

    # 기존 미사용 코드 무효화
    db.query(EmailVerification).filter(
        EmailVerification.user_id == user.id,
        EmailVerification.is_used == False,
    ).delete()

    code = _generate_code()
    verification = EmailVerification(
        user_id=user.id,
        code=code,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=VERIFY_CODE_EXPIRY_MINUTES),
    )
    db.add(verification)
    db.commit()

    email_service = get_email_service()
    await email_service.send(
        to=user.email,
        subject=f"[Benefit Butler] 인증코드: {code}",
        body_html=_build_verification_email_html(code),
    )


def verify_email_code(db: Session, user: User, code: str) -> None:
    """인증코드를 검증하고 유저의 is_email_verified를 True로 변경한다."""
    if user.is_email_verified:
        raise HTTPException(status_code=400, detail="이미 인증된 이메일입니다")

    verification = db.scalar(
        select(EmailVerification)
        .where(
            EmailVerification.user_id == user.id,
            EmailVerification.is_used == False,
        )
        .order_by(EmailVerification.created_at.desc())
    )

    if verification is None:
        raise HTTPException(status_code=400, detail="인증코드가 만료되었습니다. 재발송해주세요")

    if verification.attempts >= VERIFY_MAX_ATTEMPTS:
        raise HTTPException(status_code=400, detail="시도 횟수를 초과했습니다. 재발송해주세요")

    if datetime.now(timezone.utc) > verification.expires_at:
        raise HTTPException(status_code=400, detail="인증코드가 만료되었습니다. 재발송해주세요")

    if verification.code != code:
        verification.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="인증코드가 올바르지 않습니다")

    # 인증 성공
    verification.is_used = True
    user.is_email_verified = True
    db.commit()
