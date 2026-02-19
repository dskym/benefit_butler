# backend/app/services/category.py
import uuid

from sqlalchemy.orm import Session

from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate


def list_categories(db: Session, user_id: uuid.UUID) -> list[Category]:
    # TODO: filter by user_id
    raise NotImplementedError


def create_category(db: Session, user_id: uuid.UUID, data: CategoryCreate) -> Category:
    # TODO: create and persist Category
    raise NotImplementedError


def get_category(db: Session, user_id: uuid.UUID, category_id: uuid.UUID) -> Category:
    # TODO: fetch, verify ownership, or raise 404
    raise NotImplementedError


def update_category(db: Session, user_id: uuid.UUID, category_id: uuid.UUID, data: CategoryUpdate) -> Category:
    # TODO: fetch, patch fields, commit
    raise NotImplementedError


def delete_category(db: Session, user_id: uuid.UUID, category_id: uuid.UUID) -> None:
    # TODO: fetch, verify ownership, delete
    raise NotImplementedError
