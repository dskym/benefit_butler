"""add_monthly_target_to_cards

Revision ID: a3e7f2b1d5c8
Revises: 91fc1a350c9d
Create Date: 2026-02-21 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3e7f2b1d5c8'
down_revision: Union[str, None] = '91fc1a350c9d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_cards", sa.Column("monthly_target", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("user_cards", "monthly_target")
