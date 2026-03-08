"""add_card_catalog_and_benefits

Revision ID: c3d4e5f6a7b8
Revises: b2f3c4d5e6a7
Create Date: 2026-02-26 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2f3c4d5e6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # card_catalog table
    op.create_table(
        'card_catalog',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('issuer', sa.String(50), nullable=False),
        sa.Column('card_type', sa.String(20), nullable=False),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
    )

    # catalog_benefits table
    op.create_table(
        'catalog_benefits',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('catalog_id', UUID(as_uuid=True), sa.ForeignKey('card_catalog.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('benefit_type', sa.String(20), nullable=False),
        sa.Column('rate', sa.Float(), nullable=True),
        sa.Column('flat_amount', sa.Integer(), nullable=True),
        sa.Column('monthly_cap', sa.Integer(), nullable=True),
        sa.Column('min_amount', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
    )

    # catalog_id FK on user_cards
    op.add_column(
        'user_cards',
        sa.Column('catalog_id', UUID(as_uuid=True), sa.ForeignKey('card_catalog.id', ondelete='SET NULL'), nullable=True),
    )

    # user_card_benefits table
    op.create_table(
        'user_card_benefits',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_card_id', UUID(as_uuid=True), sa.ForeignKey('user_cards.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('benefit_type', sa.String(20), nullable=False),
        sa.Column('rate', sa.Float(), nullable=True),
        sa.Column('flat_amount', sa.Integer(), nullable=True),
        sa.Column('monthly_cap', sa.Integer(), nullable=True),
        sa.Column('min_amount', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
    )


def downgrade() -> None:
    op.drop_table('user_card_benefits')
    op.drop_column('user_cards', 'catalog_id')
    op.drop_table('catalog_benefits')
    op.drop_table('card_catalog')
