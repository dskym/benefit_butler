# Lock Default Categories Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 기본 카테고리(회원가입 시 자동 생성)는 수정·삭제할 수 없도록 백엔드와 프론트엔드 양쪽에 보호 로직을 추가한다.

**Architecture:** Category 모델에 `is_default: bool` 컬럼을 추가해 DB 레벨에서 명시적으로 기본 카테고리를 식별한다. 백엔드 서비스에서 `is_default=True` 항목에 대한 update/delete를 403으로 차단하고, 프론트엔드에서는 해당 항목의 수정·삭제 버튼을 숨긴다.

**Tech Stack:** Python/FastAPI, SQLAlchemy, Alembic, React Native (Expo), TypeScript, Zustand

---

### Task 1: Category 모델에 `is_default` 컬럼 추가

**Files:**
- Modify: `backend/app/models/category.py`

**Step 1: `is_default` 컬럼 추가**

`backend/app/models/category.py`의 `color` 컬럼 아래에 추가:

```python
from sqlalchemy import Boolean, DateTime, ForeignKey, String

is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
```

전체 import 줄도 `Boolean` 포함하도록 수정:
```python
from sqlalchemy import Boolean, DateTime, ForeignKey, String
```

**Step 2: 파일 확인**

`backend/app/models/category.py` 열어서 컬럼이 올바르게 추가됐는지 확인.

---

### Task 2: Alembic 마이그레이션 생성

**Files:**
- Create: `backend/alembic/versions/<auto>_add_is_default_to_categories.py`

**Step 1: 마이그레이션 파일 자동 생성**

```bash
cd backend && alembic revision --autogenerate -m "add_is_default_to_categories"
```

Expected: `backend/alembic/versions/<hash>_add_is_default_to_categories.py` 생성됨

**Step 2: 생성된 파일 확인**

생성된 파일을 열어서 `upgrade()` 함수가 아래와 같은 형태인지 확인:

```python
def upgrade() -> None:
    op.add_column('categories', sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false'))
```

`server_default='false'`가 없으면 직접 추가 (기존 행이 NULL이 되지 않도록).

**Step 3: 마이그레이션 적용**

```bash
cd backend && alembic upgrade head
```

Expected: 오류 없이 완료

---

### Task 3: `CategoryResponse` 스키마에 `is_default` 추가

**Files:**
- Modify: `backend/app/schemas/category.py`

**Step 1: `CategoryResponse`에 필드 추가**

```python
class CategoryResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    type: str
    color: str | None
    is_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}
```

---

### Task 4: `seed_default_categories`에서 `is_default=True` 설정

**Files:**
- Modify: `backend/app/services/category.py`

**Step 1: seed 함수 수정**

`seed_default_categories` 함수에서 `is_default=True` 추가:

```python
def seed_default_categories(db: Session, user_id: uuid.UUID) -> None:
    for item in DEFAULT_CATEGORIES:
        db.add(Category(user_id=user_id, is_default=True, **item))
    db.commit()
```

---

### Task 5: 백엔드 update/delete 보호 로직 추가

**Files:**
- Modify: `backend/app/services/category.py`

**Step 1: `update_category` 함수에 보호 추가**

`get_category` 호출 직후에 체크 추가:

```python
def update_category(
    db: Session, user_id: uuid.UUID, category_id: uuid.UUID, data: CategoryUpdate
) -> Category:
    category = get_category(db, user_id, category_id)
    if category.is_default:
        raise HTTPException(status_code=403, detail="기본 카테고리는 수정할 수 없습니다.")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return category
```

**Step 2: `delete_category` 함수에 보호 추가**

```python
def delete_category(db: Session, user_id: uuid.UUID, category_id: uuid.UUID) -> None:
    category = get_category(db, user_id, category_id)
    if category.is_default:
        raise HTTPException(status_code=403, detail="기본 카테고리는 삭제할 수 없습니다.")
    db.delete(category)
    db.commit()
```

**Step 3: 동작 확인**

백엔드 서버 실행 후 기본 카테고리 ID로 PATCH/DELETE 요청 시 `403 Forbidden` 반환 확인:
```bash
cd backend && uvicorn app.main:app --reload
```

---

### Task 6: 프론트엔드 `Category` 타입에 `is_default` 추가

**Files:**
- Modify: `frontend/src/types/index.ts`

**Step 1: 타입 수정**

```typescript
export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: "income" | "expense" | "transfer";
  color: string | null;
  is_default: boolean;
  created_at: string;
}
```

---

### Task 7: 프론트엔드 CategoryListScreen에서 버튼 숨김 처리

**Files:**
- Modify: `frontend/src/screens/categories/CategoryListScreen.tsx`

**Step 1: `renderItem` 내부 rowActions 조건부 렌더링**

`renderItem` 안의 `<View style={styles.rowActions}>` 블록을 아래로 교체:

```tsx
{!item.is_default && (
  <View style={styles.rowActions}>
    <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
      <Text style={styles.editBtnText}>수정</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
      <Text style={styles.deleteBtnText}>삭제</Text>
    </TouchableOpacity>
  </View>
)}
```

**Step 2: 동작 확인**

앱 실행 후 CategoryListScreen 진입 시:
- 기본 카테고리 행에 수정/삭제 버튼이 없음
- 사용자가 직접 만든 카테고리에는 버튼이 정상 표시됨

---

### Task 8: 커밋

**Step 1: 변경 파일 스테이징 및 커밋**

```bash
git add backend/app/models/category.py \
        backend/alembic/versions/ \
        backend/app/schemas/category.py \
        backend/app/services/category.py \
        frontend/src/types/index.ts \
        frontend/src/screens/categories/CategoryListScreen.tsx \
        docs/plans/2026-02-20-lock-default-categories.md
git commit -m "feat: lock default categories from edit and delete"
```
