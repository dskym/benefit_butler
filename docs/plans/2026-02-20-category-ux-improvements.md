# Category UX Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 카테고리 화면에서 이체 타입 제거, 사용자 생성 카테고리를 기본 카테고리 아래로 정렬, 타입별 최대 30개 제한 및 N/30 카운트 UI를 적용한다.

**Architecture:** 백엔드에서 정렬 순서 변경(is_default DESC, created_at ASC)과 30개 제한 검증을 추가하고, 프론트엔드에서 이체 타입 제거·섹션 헤더 카운트·FAB 조건부 렌더링을 처리한다. DB 스키마 변경 없음.

**Tech Stack:** Python/FastAPI, SQLAlchemy, React Native (Expo), TypeScript

---

### Task 1: 백엔드 — 카테고리 정렬 변경 (기본 먼저, 생성순)

**Files:**
- Modify: `backend/app/services/category.py`

현재 `list_categories`는 `created_at DESC` 단일 정렬이다.
`is_default DESC, created_at ASC`로 변경하면 기본 카테고리가 위에, 사용자 생성 카테고리가 아래에 생성순으로 표시된다.

**Step 1: `list_categories` 정렬 변경**

`backend/app/services/category.py`의 `list_categories` 함수를 아래로 교체:

```python
def list_categories(db: Session, user_id: uuid.UUID) -> list[Category]:
    return list(
        db.scalars(
            select(Category)
            .where(Category.user_id == user_id)
            .order_by(Category.is_default.desc(), Category.created_at.asc())
        ).all()
    )
```

**Step 2: 동작 확인**

백엔드 서버 실행 후 `GET /categories/` 응답에서 `is_default: true` 항목이 앞에 오는지 확인:
```bash
cd backend && uvicorn app.main:app --reload
```

---

### Task 2: 백엔드 — 타입별 30개 제한 추가

**Files:**
- Modify: `backend/app/services/category.py`

`create_category` 함수 맨 앞에 해당 user_id + type 조합의 카테고리 수를 세어 30개 이상이면 400을 반환하는 체크를 추가한다.

**Step 1: `create_category`에 제한 체크 추가**

`backend/app/services/category.py`의 `create_category` 함수를 아래로 교체:

```python
def create_category(db: Session, user_id: uuid.UUID, data: CategoryCreate) -> Category:
    from sqlalchemy import func
    count = db.scalar(
        select(func.count()).where(
            Category.user_id == user_id,
            Category.type == data.type,
        )
    )
    if count >= 30:
        raise HTTPException(
            status_code=400,
            detail=f"{'수입' if data.type == 'income' else '지출'} 카테고리는 최대 30개까지 만들 수 있습니다.",
        )
    category = Category(
        user_id=user_id,
        name=data.name,
        type=data.type,
        color=data.color,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category
```

**Step 2: 동작 확인**

이미 30개가 있는 상태에서 `POST /categories/` 호출 시 `400 Bad Request` 반환 확인 (직접 테스트하거나 코드 리뷰로 확인).

---

### Task 3: 프론트엔드 — FormModal에서 이체 타입 제거

**Files:**
- Modify: `frontend/src/screens/categories/CategoryListScreen.tsx`

**Step 1: FormModal 타입 선택지에서 transfer 제거**

`FormModal` 컴포넌트 내부의 type 선택 `map` 배열을 변경:

```tsx
// 변경 전
{(["income", "expense", "transfer"] as CategoryType[]).map((t) => (

// 변경 후
{(["income", "expense"] as CategoryType[]).map((t) => (
```

`frontend/src/screens/categories/CategoryListScreen.tsx:94` 줄의 배열을 수정한다.

---

### Task 4: 프론트엔드 — 섹션 헤더에 N/30 카운트 표시

**Files:**
- Modify: `frontend/src/screens/categories/CategoryListScreen.tsx`

섹션 헤더 우측에 `현재수/30` 카운트를 표시한다. 30개 달성 시 숫자를 빨간색(`theme.colors.expense`)으로 표시한다.

**Step 1: `renderSectionHeader`를 아래로 교체**

```tsx
renderSectionHeader={({ section }) => (
  <View style={styles.sectionHeaderRow}>
    <View style={[styles.sectionDot, { backgroundColor: TYPE_COLORS[section.type] }]} />
    <Text style={styles.sectionLabel}>{section.title}</Text>
    <Text style={[
      styles.sectionCount,
      section.data.length >= 30 && { color: theme.colors.expense },
    ]}>
      {section.data.length}/30
    </Text>
  </View>
)}
```

**Step 2: `sectionHeaderRow` 스타일에 `justifyContent` 추가, `sectionCount` 스타일 추가**

`StyleSheet.create` 블록에서:

```ts
sectionHeaderRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",   // 추가
  paddingTop: theme.spacing.md,
  paddingBottom: theme.spacing.xs,
},
sectionCount: {   // 새로 추가
  ...theme.typography.caption,
  color: theme.colors.text.hint,
  fontWeight: "600",
},
```

---

### Task 5: 프론트엔드 — 수입·지출 모두 30개 달성 시 FAB 숨김

**Files:**
- Modify: `frontend/src/screens/categories/CategoryListScreen.tsx`

수입 카테고리 수 + 지출 카테고리 수가 각각 30개에 도달하면 새 카테고리를 추가할 수 없으므로 FAB를 숨긴다.

**Step 1: `canAddMore` 파생 변수 추가**

`sections` useMemo 아래에 추가:

```tsx
const canAddMore = useMemo(() => {
  const incomeCount = categories.filter((c) => c.type === "income").length;
  const expenseCount = categories.filter((c) => c.type === "expense").length;
  return incomeCount < 30 || expenseCount < 30;
}, [categories]);
```

**Step 2: FAB를 조건부 렌더링으로 교체**

```tsx
{canAddMore && (
  <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.85}>
    <Text style={styles.fabText}>+</Text>
  </TouchableOpacity>
)}
```

---

### Task 6: 커밋

**Step 1: 변경 파일 스테이징 및 커밋**

```bash
git add backend/app/services/category.py \
        frontend/src/screens/categories/CategoryListScreen.tsx \
        docs/plans/2026-02-20-category-ux-improvements.md
git commit -m "feat: category UX improvements - sort, limit, and transfer removal"
```
