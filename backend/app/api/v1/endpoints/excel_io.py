# backend/app/api/v1/endpoints/excel_io.py
from fastapi import APIRouter, Depends, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.v1.endpoints.auth import get_current_user
from app.core.database import get_db
from app.schemas.excel_io import ImportConfirmRequest, ImportConfirmResponse, ImportPreviewResponse
from app.services import excel_io as excel_service

router = APIRouter(prefix="/transactions", tags=["excel"])

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


@router.post("/import/preview", response_model=ImportPreviewResponse)
async def import_preview(
    file: UploadFile,
    current_user=Depends(get_current_user),
):
    """Upload an xlsx file and return a preview with auto-detected column mapping."""
    if not file.filename or not file.filename.endswith(".xlsx"):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=".xlsx 파일만 지원합니다.")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="파일 크기가 5MB를 초과합니다.")

    return excel_service.parse_and_preview(contents)


@router.post(
    "/import/confirm",
    response_model=ImportConfirmResponse,
    status_code=status.HTTP_201_CREATED,
)
def import_confirm(
    body: ImportConfirmRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Confirm the column mapping and create transactions from the cached data."""
    return excel_service.confirm_import(
        db,
        current_user.id,
        body.import_id,
        body.mapping,
        body.default_type,
    )


@router.get("/export")
def export_transactions(
    period: str = Query(default="month", pattern="^(month|year|all)$"),
    year: int | None = None,
    month: int | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Export transactions as an xlsx file."""
    buf = excel_service.export_transactions(db, current_user.id, period, year, month)

    filename = "transactions"
    if period == "month" and year and month:
        filename = f"transactions_{year}_{month:02d}"
    elif period == "year" and year:
        filename = f"transactions_{year}"

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}.xlsx"'},
    )
