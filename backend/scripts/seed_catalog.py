"""카드 카탈로그 시드 적재 CLI.

사용법: cd backend && python -m scripts.seed_catalog
사전에 `alembic upgrade head`로 스키마를 최신화해야 한다. 재실행해도 안전(멱등).
"""
from app.core.database import SessionLocal
from app.services.catalog_seed import load_catalog_seed


def main() -> None:
    db = SessionLocal()
    try:
        counts = load_catalog_seed(db)
        print(
            f"시드 적재 완료: 가맹점 {counts['merchants']}개, "
            f"카드 {counts['cards']}종, 혜택 {counts['benefits']}건"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
