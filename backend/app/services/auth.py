# backend/app/services/auth.py
import uuid

from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User
from app.schemas.user import UserCreate


def register_user(db: Session, data: UserCreate) -> User:
    # TODO: check duplicate email
    # TODO: create User with hashed password
    # TODO: db.add / db.commit / db.refresh
    raise NotImplementedError


def authenticate_user(db: Session, email: str, password: str) -> str:
    """Returns JWT access token or raises HTTPException 401."""
    # TODO: fetch user by email
    # TODO: verify_password
    # TODO: create_access_token
    raise NotImplementedError


def get_user_by_id(db: Session, user_id: uuid.UUID) -> User:
    # TODO: return db.get(User, user_id) or raise 404
    raise NotImplementedError
