# backend/app/api/v1/endpoints/auth.py
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse, VerifyEmailRequest, MessageResponse
import app.services.auth as auth_service
from app.services.category import seed_default_categories
from app.services.verification import create_and_send_verification, verify_email_code

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    try:
        user_id_str = decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return auth_service.get_user_by_id(db, uuid.UUID(user_id_str))


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, db: Session = Depends(get_db)):
    user = auth_service.register_user(db, data)
    seed_default_categories(db, user.id)
    try:
        await create_and_send_verification(db, user)
    except Exception:
        pass  # 이메일 발송 실패해도 가입은 완료 — 재발송으로 처리
    return user


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    token = auth_service.authenticate_user(db, data.email, data.password)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def me(current_user=Depends(get_current_user)):
    return current_user


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(
    data: VerifyEmailRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_email_code(db, current_user, data.code)
    return MessageResponse(message="이메일 인증이 완료되었습니다")


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    await create_and_send_verification(db, current_user)
    return MessageResponse(message="인증코드가 재발송되었습니다")
