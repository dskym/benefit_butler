# backend/app/schemas/excel_io.py
from pydantic import BaseModel


class ColumnMapping(BaseModel):
    transacted_at: int | None = None   # 엑셀 컬럼 인덱스 (0-based)
    amount: int | None = None
    description: int | None = None
    type: int | None = None            # income/expense/transfer
    category_name: int | None = None
    payment_type: int | None = None
    card_name: int | None = None


class ImportPreviewResponse(BaseModel):
    import_id: str
    headers: list[str]
    auto_mapping: ColumnMapping
    preview_rows: list[list[str | None]]  # 최대 10행
    total_rows: int


class ImportConfirmRequest(BaseModel):
    import_id: str
    mapping: ColumnMapping
    default_type: str = "expense"


class ImportConfirmResponse(BaseModel):
    created_count: int
    duplicate_count: int
    error_count: int
    errors: list[dict]   # [{row: int, message: str}]
