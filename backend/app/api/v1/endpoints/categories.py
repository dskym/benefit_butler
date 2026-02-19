# backend/app/api/v1/endpoints/categories.py
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.v1.endpoints.auth import get_current_user
from app.core.database import get_db
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
import app.services.category as category_service

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/", response_model=list[CategoryResponse])
def list_categories(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # TODO: category_service.list_categories(db, current_user.id)
    raise NotImplementedError


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(data: CategoryCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # TODO: category_service.create_category(db, current_user.id, data)
    raise NotImplementedError


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(category_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # TODO: category_service.get_category(db, current_user.id, category_id)
    raise NotImplementedError


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(category_id: uuid.UUID, data: CategoryUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # TODO: category_service.update_category(db, current_user.id, category_id, data)
    raise NotImplementedError


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # TODO: category_service.delete_category(db, current_user.id, category_id)
    raise NotImplementedError
