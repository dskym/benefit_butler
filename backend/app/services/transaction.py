# backend/app/services/transaction.py
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate, TransactionUpdate


def list_transactions(db: Session, user_id: uuid.UUID) -> list[Transaction]:
    return list(
        db.scalars(
            select(Transaction)
            .where(Transaction.user_id == user_id)
            .order_by(Transaction.transacted_at.desc())
        ).all()
    )


def create_transaction(db: Session, user_id: uuid.UUID, data: TransactionCreate) -> Transaction:
    transaction = Transaction(
        user_id=user_id,
        category_id=data.category_id,
        type=data.type,
        amount=data.amount,
        description=data.description,
        transacted_at=data.transacted_at,
        payment_type=data.payment_type,
        user_card_id=data.user_card_id,
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


def get_transaction(db: Session, user_id: uuid.UUID, tx_id: uuid.UUID) -> Transaction:
    transaction = db.scalar(
        select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == user_id)
    )
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


def update_transaction(
    db: Session, user_id: uuid.UUID, tx_id: uuid.UUID, data: TransactionUpdate
) -> Transaction:
    transaction = get_transaction(db, user_id, tx_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(transaction, field, value)
    db.commit()
    db.refresh(transaction)
    return transaction


def delete_transaction(db: Session, user_id: uuid.UUID, tx_id: uuid.UUID) -> None:
    transaction = get_transaction(db, user_id, tx_id)
    db.delete(transaction)
    db.commit()


def set_favorite(db: Session, user_id: uuid.UUID, tx_id: uuid.UUID, is_favorite: bool) -> Transaction:
    transaction = get_transaction(db, user_id, tx_id)
    transaction.is_favorite = is_favorite
    db.commit()
    db.refresh(transaction)
    return transaction
