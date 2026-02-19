# backend/app/api/v1/endpoints/transactions.py
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.v1.endpoints.auth import get_current_user
from app.core.database import get_db
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionResponse
import app.services.transaction as transaction_service

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("/", response_model=list[TransactionResponse])
def list_transactions(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return transaction_service.list_transactions(db, current_user.id)


@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(data: TransactionCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return transaction_service.create_transaction(db, current_user.id, data)


@router.get("/{tx_id}", response_model=TransactionResponse)
def get_transaction(tx_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return transaction_service.get_transaction(db, current_user.id, tx_id)


@router.put("/{tx_id}", response_model=TransactionResponse)
def update_transaction(tx_id: uuid.UUID, data: TransactionUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return transaction_service.update_transaction(db, current_user.id, tx_id, data)


@router.delete("/{tx_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(tx_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    transaction_service.delete_transaction(db, current_user.id, tx_id)
