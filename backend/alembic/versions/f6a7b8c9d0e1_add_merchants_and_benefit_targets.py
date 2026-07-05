"""add_merchants_and_benefit_targets

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-07-05 22:30:00.000000

가맹점(merchants/merchant_aliases) 테이블과 혜택-가맹점 M:N 조인 테이블을 추가하고,
혜택 테이블에 2계층 타겟(target_type: all/category/merchant) 컬럼을 도입한다.
기존 category='전체' 행은 target_type='all'로 백필한다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_BENEFIT_TABLES = ("catalog_benefits", "user_card_benefits")


def upgrade() -> None:
    op.create_table(
        'merchants',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(length=100), nullable=False, unique=True),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_table(
        'merchant_aliases',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('merchant_id', UUID(as_uuid=True),
                  sa.ForeignKey('merchants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('alias_normalized', sa.String(length=100), nullable=False),
    )
    op.create_index('ix_merchant_aliases_alias_normalized', 'merchant_aliases', ['alias_normalized'], unique=True)

    op.create_table(
        'catalog_benefit_merchants',
        sa.Column('benefit_id', UUID(as_uuid=True),
                  sa.ForeignKey('catalog_benefits.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('merchant_id', UUID(as_uuid=True),
                  sa.ForeignKey('merchants.id', ondelete='CASCADE'), primary_key=True),
    )
    op.create_table(
        'user_card_benefit_merchants',
        sa.Column('benefit_id', UUID(as_uuid=True),
                  sa.ForeignKey('user_card_benefits.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('merchant_id', UUID(as_uuid=True),
                  sa.ForeignKey('merchants.id', ondelete='CASCADE'), primary_key=True),
    )

    for table in _BENEFIT_TABLES:
        op.add_column(table, sa.Column('title', sa.String(length=100), nullable=True))
        op.add_column(table, sa.Column('target_type', sa.String(length=10),
                                       nullable=False, server_default=sa.text("'category'")))
        op.add_column(table, sa.Column('requires_performance', sa.Boolean(),
                                       nullable=False, server_default=sa.text('false')))
        op.alter_column(table, 'category', existing_type=sa.String(length=50), nullable=True)
        op.execute(f"UPDATE {table} SET target_type = 'all', category = NULL WHERE category = '전체'")


def downgrade() -> None:
    for table in _BENEFIT_TABLES:
        op.execute(f"UPDATE {table} SET category = '전체' WHERE target_type = 'all'")
        # merchant 타겟 혜택은 구 스키마에서 표현 불가 — '전체'로 강등해 NOT NULL 복원
        op.execute(f"UPDATE {table} SET category = '전체' WHERE category IS NULL")
        op.alter_column(table, 'category', existing_type=sa.String(length=50), nullable=False)
        op.drop_column(table, 'requires_performance')
        op.drop_column(table, 'target_type')
        op.drop_column(table, 'title')

    op.drop_table('user_card_benefit_merchants')
    op.drop_table('catalog_benefit_merchants')
    op.drop_index('ix_merchant_aliases_alias_normalized', table_name='merchant_aliases')
    op.drop_table('merchant_aliases')
    op.drop_table('merchants')
