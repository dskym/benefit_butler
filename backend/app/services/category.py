# backend/app/services/category.py
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate


def list_categories(db: Session, user_id: uuid.UUID) -> list[Category]:
    return list(
        db.scalars(
            select(Category)
            .where(Category.user_id == user_id)
            .order_by(Category.created_at.desc())
        ).all()
    )


def create_category(db: Session, user_id: uuid.UUID, data: CategoryCreate) -> Category:
    category = Category(
        user_id=user_id,
        name=data.name,
        type=data.type,
        color=data.color,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def get_category(db: Session, user_id: uuid.UUID, category_id: uuid.UUID) -> Category:
    category = db.scalar(
        select(Category).where(Category.id == category_id, Category.user_id == user_id)
    )
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


def update_category(
    db: Session, user_id: uuid.UUID, category_id: uuid.UUID, data: CategoryUpdate
) -> Category:
    category = get_category(db, user_id, category_id)
    if category.is_default:
        raise HTTPException(status_code=403, detail="기본 카테고리는 수정할 수 없습니다.")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return category


def delete_category(db: Session, user_id: uuid.UUID, category_id: uuid.UUID) -> None:
    category = get_category(db, user_id, category_id)
    if category.is_default:
        raise HTTPException(status_code=403, detail="기본 카테고리는 삭제할 수 없습니다.")
    db.delete(category)
    db.commit()


DEFAULT_CATEGORIES: list[dict] = [
    # income
    {"name": "급여",     "type": "income",  "color": "#22C55E"},
    {"name": "이자·배당","type": "income",  "color": "#0D9488"},
    {"name": "용돈",     "type": "income",  "color": "#6366F1"},
    {"name": "부업",     "type": "income",  "color": "#8B5CF6"},
    {"name": "상여금",   "type": "income",  "color": "#F59E0B"},
    {"name": "투자수익", "type": "income",  "color": "#84CC16"},
    {"name": "기타수입", "type": "income",  "color": "#8B95A1"},
    # expense
    {"name": "식비",     "type": "expense", "color": "#F04452"},
    {"name": "교통",     "type": "expense", "color": "#EF4444"},
    {"name": "주거·통신","type": "expense", "color": "#F97316"},
    {"name": "쇼핑",     "type": "expense", "color": "#F59E0B"},
    {"name": "의료·건강","type": "expense", "color": "#EAB308"},
    {"name": "문화·여가","type": "expense", "color": "#06B6D4"},
    {"name": "교육",     "type": "expense", "color": "#8B5CF6"},
    {"name": "금융",     "type": "expense", "color": "#EC4899"},
    {"name": "경조사",   "type": "expense", "color": "#84CC16"},
    {"name": "기타지출", "type": "expense", "color": "#8B95A1"},
]


def seed_default_categories(db: Session, user_id: uuid.UUID) -> None:
    for item in DEFAULT_CATEGORIES:
        db.add(Category(user_id=user_id, is_default=True, **item))
    db.commit()
