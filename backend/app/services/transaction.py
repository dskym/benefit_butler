# backend/app/services/transaction.py
import uuid

from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate, TransactionUpdate


def list_transactions(db: Session, user_id: uuid.UUID) -> list[Transaction]:
    # TODO: filter by user_id, order by transacted_at desc
    raise NotImplementedError


def create_transaction(db: Session, user_id: uuid.UUID, data: TransactionCreate) -> Transaction:
    # TODO: create and persist Transaction
    raise NotImplementedError


def get_transaction(db: Session, user_id: uuid.UUID, tx_id: uuid.UUID) -> Transaction:
    # TODO: fetch, verify ownership, or raise 404
    raise NotImplementedError


def update_transaction(db: Session, user_id: uuid.UUID, tx_id: uuid.UUID, data: TransactionUpdate) -> Transaction:
    # TODO: fetch, patch fields, commit
    raise NotImplementedError


def delete_transaction(db: Session, user_id: uuid.UUID, tx_id: uuid.UUID) -> None:
    # TODO: fetch, verify ownership, delete
    raise NotImplementedError
