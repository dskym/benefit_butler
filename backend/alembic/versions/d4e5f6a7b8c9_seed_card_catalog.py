"""seed_card_catalog

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-02-26 10:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Seed catalog IDs (stable UUIDs for reproducibility)
CATALOG_SEEDS = [
    # (id, name, issuer, card_type)
    ("11111111-0001-0001-0001-000000000001", "Deep Dream 카드", "신한카드", "credit_card"),
    ("11111111-0001-0001-0001-000000000002", "Mr.Life 카드", "신한카드", "credit_card"),
    ("11111111-0001-0001-0001-000000000003", "노리 1.5 카드", "KB국민카드", "credit_card"),
    ("11111111-0001-0001-0001-000000000004", "탄탄대로 티타늄 카드", "KB국민카드", "credit_card"),
    ("11111111-0001-0001-0001-000000000005", "taptap O 카드", "삼성카드", "credit_card"),
    ("11111111-0001-0001-0001-000000000006", "삼성 iD SIMPLE 카드", "삼성카드", "credit_card"),
    ("11111111-0001-0001-0001-000000000007", "제로 에디션2 카드", "현대카드", "credit_card"),
    ("11111111-0001-0001-0001-000000000008", "M 에디션2 카드", "현대카드", "credit_card"),
    ("11111111-0001-0001-0001-000000000009", "하나 1Q 카드", "하나카드", "credit_card"),
    ("11111111-0001-0001-0001-000000000010", "더 클래스 카드", "우리카드", "credit_card"),
    ("11111111-0001-0001-0001-000000000011", "로카 365 카드", "롯데카드", "credit_card"),
    ("11111111-0001-0001-0001-000000000012", "BC 바로 포인트 카드", "BC카드", "credit_card"),
    ("11111111-0001-0001-0001-000000000013", "토스 신용카드", "하나카드", "credit_card"),
    ("11111111-0001-0001-0001-000000000014", "카카오뱅크 체크카드", "카카오뱅크", "debit_card"),
    ("11111111-0001-0001-0001-000000000015", "토스뱅크 체크카드", "토스뱅크", "debit_card"),
]

# (catalog_id, category, benefit_type, rate, flat_amount, monthly_cap, min_amount)
BENEFIT_SEEDS = [
    # Deep Dream 카드 — 식비/쇼핑 3% 캐시백
    ("11111111-0001-0001-0001-000000000001", "식비", "cashback", 3.0, None, 10000, 5000),
    ("11111111-0001-0001-0001-000000000001", "쇼핑", "cashback", 3.0, None, 10000, 5000),
    ("11111111-0001-0001-0001-000000000001", "전체", "cashback", 1.0, None, 5000, None),

    # Mr.Life 카드 — 교통/통신 5% 할인
    ("11111111-0001-0001-0001-000000000002", "교통", "cashback", 5.0, None, 15000, 3000),
    ("11111111-0001-0001-0001-000000000002", "통신", "cashback", 5.0, None, 10000, None),
    ("11111111-0001-0001-0001-000000000002", "전체", "cashback", 0.5, None, 3000, None),

    # 노리 1.5 카드 — 전 업종 1.5% 캐시백
    ("11111111-0001-0001-0001-000000000003", "전체", "cashback", 1.5, None, 30000, None),

    # 탄탄대로 티타늄 — 주유/마트 할인
    ("11111111-0001-0001-0001-000000000004", "주유", "cashback", 4.0, None, 20000, 10000),
    ("11111111-0001-0001-0001-000000000004", "쇼핑", "cashback", 2.0, None, 10000, 10000),
    ("11111111-0001-0001-0001-000000000004", "전체", "cashback", 0.5, None, 5000, None),

    # taptap O — 쇼핑 5%, 식비 3%
    ("11111111-0001-0001-0001-000000000005", "쇼핑", "cashback", 5.0, None, 20000, 5000),
    ("11111111-0001-0001-0001-000000000005", "식비", "cashback", 3.0, None, 10000, 5000),
    ("11111111-0001-0001-0001-000000000005", "전체", "points", 1.0, None, None, None),

    # 삼성 iD SIMPLE — 전 업종 1% 포인트
    ("11111111-0001-0001-0001-000000000006", "전체", "points", 1.0, None, None, None),

    # 현대 제로 에디션2 — 전 업종 1.5% 캐시백
    ("11111111-0001-0001-0001-000000000007", "전체", "cashback", 1.5, None, 30000, None),

    # 현대 M 에디션2 — 전 업종 2% M포인트
    ("11111111-0001-0001-0001-000000000008", "전체", "points", 2.0, None, None, None),

    # 하나 1Q — 교통/쇼핑 3%
    ("11111111-0001-0001-0001-000000000009", "교통", "cashback", 3.0, None, 10000, 3000),
    ("11111111-0001-0001-0001-000000000009", "쇼핑", "cashback", 3.0, None, 10000, 5000),
    ("11111111-0001-0001-0001-000000000009", "전체", "cashback", 0.5, None, 3000, None),

    # 우리 더 클래스 — 식비/여행 2%
    ("11111111-0001-0001-0001-000000000010", "식비", "cashback", 2.0, None, 8000, None),
    ("11111111-0001-0001-0001-000000000010", "여행", "cashback", 2.0, None, 15000, None),
    ("11111111-0001-0001-0001-000000000010", "전체", "cashback", 0.7, None, 5000, None),

    # 롯데 로카365 — 전 업종 1% 포인트
    ("11111111-0001-0001-0001-000000000011", "전체", "points", 1.0, None, None, None),

    # BC 바로 포인트 — 전 업종 1.5% 포인트
    ("11111111-0001-0001-0001-000000000012", "전체", "points", 1.5, None, None, None),

    # 토스 신용카드 — 전 업종 2% 캐시백
    ("11111111-0001-0001-0001-000000000013", "전체", "cashback", 2.0, None, 30000, None),

    # 카카오뱅크 체크 — 전 업종 0.5% 캐시백
    ("11111111-0001-0001-0001-000000000014", "전체", "cashback", 0.5, None, 10000, None),

    # 토스뱅크 체크 — 전 업종 0.5% + 편의점 2%
    ("11111111-0001-0001-0001-000000000015", "전체", "cashback", 0.5, None, 5000, None),
    ("11111111-0001-0001-0001-000000000015", "쇼핑", "cashback", 2.0, None, 5000, None),
]


def upgrade() -> None:
    catalog_table = sa.table(
        'card_catalog',
        sa.column('id', sa.Text),
        sa.column('name', sa.Text),
        sa.column('issuer', sa.Text),
        sa.column('card_type', sa.Text),
        sa.column('is_active', sa.Boolean),
    )
    op.bulk_insert(
        catalog_table,
        [
            {"id": row[0], "name": row[1], "issuer": row[2], "card_type": row[3], "is_active": True}
            for row in CATALOG_SEEDS
        ],
    )

    benefit_table = sa.table(
        'catalog_benefits',
        sa.column('id', sa.Text),
        sa.column('catalog_id', sa.Text),
        sa.column('category', sa.Text),
        sa.column('benefit_type', sa.Text),
        sa.column('rate', sa.Float),
        sa.column('flat_amount', sa.Integer),
        sa.column('monthly_cap', sa.Integer),
        sa.column('min_amount', sa.Integer),
    )
    import uuid as _uuid
    op.bulk_insert(
        benefit_table,
        [
            {
                "id": str(_uuid.uuid4()),
                "catalog_id": row[0],
                "category": row[1],
                "benefit_type": row[2],
                "rate": row[3],
                "flat_amount": row[4],
                "monthly_cap": row[5],
                "min_amount": row[6],
            }
            for row in BENEFIT_SEEDS
        ],
    )


def downgrade() -> None:
    op.execute("DELETE FROM catalog_benefits WHERE catalog_id IN (SELECT id FROM card_catalog WHERE id::text LIKE '11111111%')")
    op.execute("DELETE FROM card_catalog WHERE id::text LIKE '11111111%'")
