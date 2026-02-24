"""add_billing_day_to_user_cards

Revision ID: b2f3c4d5e6a7
Revises: a3e7f2b1d5c8
Create Date: 2026-02-25 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2f3c4d5e6a7'
down_revision: Union[str, None] = '8570786b7481'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_cards", sa.Column("billing_day", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("user_cards", "billing_day")
