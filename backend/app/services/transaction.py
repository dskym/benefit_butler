# backend/app/services/transaction.py
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate, TransactionUpdate


def list_transactions(
    db: Session,
    user_id: uuid.UUID,
    card_id: uuid.UUID | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
) -> list[Transaction]:
    query = select(Transaction).where(Transaction.user_id == user_id)
    if card_id is not None:
        query = query.where(Transaction.user_card_id == card_id)
    if from_date is not None:
        start_dt = datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc)
        query = query.where(Transaction.transacted_at >= start_dt)
    if to_date is not None:
        next_day = to_date + timedelta(days=1)
        end_dt = datetime(next_day.year, next_day.month, next_day.day, tzinfo=timezone.utc)
        query = query.where(Transaction.transacted_at < end_dt)
    return list(
        db.scalars(query.order_by(Transaction.transacted_at.desc())).all()
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
