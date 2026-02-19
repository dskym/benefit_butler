# backend/app/api/v1/endpoints/auth.py
from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse
import app.services.auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    # TODO: decode_token(credentials.credentials) → user_id
    # TODO: auth_service.get_user_by_id(db, user_id)
    raise NotImplementedError


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, db: Session = Depends(get_db)):
    # TODO: auth_service.register_user(db, data)
    raise NotImplementedError


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    # TODO: auth_service.authenticate_user(db, data.email, data.password)
    raise NotImplementedError


@router.get("/me", response_model=UserResponse)
def me(current_user=Depends(get_current_user)):
    return current_user
