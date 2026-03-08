import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.models.card_catalog import CardCatalog
from app.models.card_benefit import CatalogBenefit
from app.schemas.card_catalog import CardCatalogResponse

router = APIRouter(prefix="/cards/catalog", tags=["card-catalog"])


@router.get("/", response_model=list[CardCatalogResponse])
def list_catalog(
    q: str | None = Query(default=None, description="이름/발급사 검색어"),
    db: Session = Depends(get_db),
):
    stmt = select(CardCatalog).where(CardCatalog.is_active == True)
    if q:
        stmt = stmt.where(
            CardCatalog.name.ilike(f"%{q}%") | CardCatalog.issuer.ilike(f"%{q}%")
        )
    return list(db.scalars(stmt.order_by(CardCatalog.issuer, CardCatalog.name)).all())


@router.get("/{catalog_id}", response_model=CardCatalogResponse)
def get_catalog(
    catalog_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    from fastapi import HTTPException
    card = db.scalar(select(CardCatalog).where(CardCatalog.id == catalog_id, CardCatalog.is_active == True))
    if card is None:
        raise HTTPException(status_code=404, detail="Catalog card not found")
    return card
