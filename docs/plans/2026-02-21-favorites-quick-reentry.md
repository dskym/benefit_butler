# Favorites & Quick Re-entry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a favorites system that lets users long-press any transaction to mark it as a favorite, then tap a chip at the top of the transaction list to instantly re-enter that transaction (all fields pre-filled, date reset to today).

**Architecture:** `is_favorite` boolean column on the DB `transactions` table (server default `false`). The backend exposes `PATCH /transactions/{id}/favorite` to toggle the flag. The frontend Zustand store adds `toggleFavorite`. `TransactionListScreen` gains a horizontal `FavoritesRow` chip bar and a long-press context menu; `FormModal` gains a `prefill` prop that pre-fills fields from a favorite while resetting the date to today.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic (backend); React Native + Zustand (frontend); no new libraries needed.

---

### Task 1: Backend model — add `is_favorite` to `Transaction`

**Files:**
- Modify: `backend/app/models/transaction.py`

**Step 1: Open the model file and add the new column**

In `backend/app/models/transaction.py`, after the existing imports, add `Boolean` to the SQLAlchemy import and add the new column:

```python
# Change this line:
from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
# To:
from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text
```

Then add the column before `transacted_at`:

```python
    is_favorite: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)
```

Full updated file for reference:
```python
# backend/app/models/transaction.py
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    user_card_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_cards.id", ondelete="SET NULL"), nullable=True
    )
    is_favorite: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)
    transacted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
```

**Step 2: Commit**

```bash
git add backend/app/models/transaction.py
git commit -m "feat: add is_favorite column to Transaction model"
```

---

### Task 2: Backend migration — create and apply Alembic migration

**Files:**
- Create: `backend/alembic/versions/<rev>_add_is_favorite_to_transactions.py`

**Step 1: Generate migration via autogenerate**

```bash
cd backend && source .venv/bin/activate
alembic revision --autogenerate -m "add_is_favorite_to_transactions"
```

Expected: new file created in `backend/alembic/versions/` with a name like `<hash>_add_is_favorite_to_transactions.py`

**Step 2: Verify the generated migration**

Open the generated file. The `upgrade()` function must contain:

```python
def upgrade() -> None:
    op.add_column('transactions', sa.Column('is_favorite', sa.Boolean(), server_default='false', nullable=False))
```

And `downgrade()` must contain:

```python
def downgrade() -> None:
    op.drop_column('transactions', 'is_favorite')
```

If autogenerate produced something different, edit the file to match the above.

**Step 3: Apply the migration**

```bash
alembic upgrade head
```

Expected output ends with: `Running upgrade a3e7f2b1d5c8 -> <new_rev>, add_is_favorite_to_transactions`

**Step 4: Commit**

```bash
git add backend/alembic/versions/
git commit -m "feat: add alembic migration for is_favorite column"
```

---

### Task 3: Backend schemas — expose `is_favorite` in response and add `FavoritePatch`

**Files:**
- Modify: `backend/app/schemas/transaction.py`

**Step 1: Add `is_favorite` to `TransactionResponse` and a new `FavoritePatch` schema**

Full updated file:

```python
# backend/app/schemas/transaction.py
import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class TransactionCreate(BaseModel):
    type: str  # income/expense/transfer
    amount: Decimal
    description: str | None = None
    category_id: uuid.UUID | None = None
    transacted_at: datetime
    payment_type: str | None = None  # "cash" | "credit_card" | "debit_card" | "bank"
    user_card_id: uuid.UUID | None = None


class TransactionUpdate(BaseModel):
    type: str | None = None
    amount: Decimal | None = None
    description: str | None = None
    category_id: uuid.UUID | None = None
    transacted_at: datetime | None = None
    payment_type: str | None = None
    user_card_id: uuid.UUID | None = None


class FavoritePatch(BaseModel):
    is_favorite: bool


class TransactionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    category_id: uuid.UUID | None
    type: str
    amount: Decimal
    description: str | None
    transacted_at: datetime
    created_at: datetime
    updated_at: datetime
    payment_type: str | None
    user_card_id: uuid.UUID | None
    is_favorite: bool

    model_config = {"from_attributes": True}
```

**Step 2: Commit**

```bash
git add backend/app/schemas/transaction.py
git commit -m "feat: add is_favorite to TransactionResponse schema and FavoritePatch"
```

---

### Task 4: Backend service — add `set_favorite` function

**Files:**
- Modify: `backend/app/services/transaction.py`

**Step 1: Add `set_favorite` to the service**

Append this function to `backend/app/services/transaction.py`:

```python
def set_favorite(db: Session, user_id: uuid.UUID, tx_id: uuid.UUID, is_favorite: bool) -> Transaction:
    transaction = get_transaction(db, user_id, tx_id)
    transaction.is_favorite = is_favorite
    db.commit()
    db.refresh(transaction)
    return transaction
```

**Step 2: Commit**

```bash
git add backend/app/services/transaction.py
git commit -m "feat: add set_favorite service function"
```

---

### Task 5: Backend endpoint — add `PATCH /transactions/{tx_id}/favorite`

**Files:**
- Modify: `backend/app/api/v1/endpoints/transactions.py`

**Step 1: Add the PATCH endpoint**

Update the imports and add the endpoint. Full updated file:

```python
# backend/app/api/v1/endpoints/transactions.py
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.v1.endpoints.auth import get_current_user
from app.core.database import get_db
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionResponse, FavoritePatch
import app.services.transaction as transaction_service

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("/", response_model=list[TransactionResponse])
def list_transactions(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return transaction_service.list_transactions(db, current_user.id)


@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(data: TransactionCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return transaction_service.create_transaction(db, current_user.id, data)


@router.get("/{tx_id}", response_model=TransactionResponse)
def get_transaction(tx_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return transaction_service.get_transaction(db, current_user.id, tx_id)


@router.put("/{tx_id}", response_model=TransactionResponse)
def update_transaction(tx_id: uuid.UUID, data: TransactionUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return transaction_service.update_transaction(db, current_user.id, tx_id, data)


@router.patch("/{tx_id}/favorite", response_model=TransactionResponse)
def set_favorite(tx_id: uuid.UUID, data: FavoritePatch, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return transaction_service.set_favorite(db, current_user.id, tx_id, data.is_favorite)


@router.delete("/{tx_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(tx_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    transaction_service.delete_transaction(db, current_user.id, tx_id)
```

**Step 2: Start the backend and verify the new endpoint is listed**

```bash
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload
```

Open `http://localhost:8000/docs` and confirm `PATCH /transactions/{tx_id}/favorite` appears.

**Step 3: Commit**

```bash
git add backend/app/api/v1/endpoints/transactions.py
git commit -m "feat: add PATCH /transactions/{id}/favorite endpoint"
```

---

### Task 6: Frontend types — add `is_favorite` to `Transaction`

**Files:**
- Modify: `frontend/src/types/index.ts`

**Step 1: Add the field**

In `frontend/src/types/index.ts`, update the `Transaction` interface:

```typescript
export interface Transaction {
  id: string;
  user_id: string;
  category_id: string | null;
  type: "income" | "expense" | "transfer";
  amount: number;
  description: string | null;
  transacted_at: string;
  created_at: string;
  updated_at: string;
  payment_type: "cash" | "credit_card" | "debit_card" | "bank" | null;
  user_card_id: string | null;
  is_favorite?: boolean;
}
```

**Step 2: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat: add is_favorite field to Transaction type"
```

---

### Task 7: Frontend store — add `toggleFavorite` action

**Files:**
- Modify: `frontend/src/store/transactionStore.ts`

**Step 1: Add the action to the interface and implementation**

Full updated file:

```typescript
// frontend/src/store/transactionStore.ts
import { create } from "zustand";
import { Transaction } from "../types";
import { apiClient } from "../services/api";

interface TransactionCreate {
  type: "income" | "expense" | "transfer";
  amount: number;
  description?: string;
  category_id?: string;
  transacted_at: string;
  payment_type?: "cash" | "credit_card" | "debit_card" | "bank";
  user_card_id?: string;
}

interface TransactionUpdate {
  type?: "income" | "expense" | "transfer";
  amount?: number;
  description?: string;
  category_id?: string;
  transacted_at?: string;
  payment_type?: "cash" | "credit_card" | "debit_card" | "bank";
  user_card_id?: string;
}

interface TransactionState {
  transactions: Transaction[];
  isLoading: boolean;
  fetchTransactions: () => Promise<void>;
  createTransaction: (data: TransactionCreate) => Promise<void>;
  updateTransaction: (id: string, data: TransactionUpdate) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  toggleFavorite: (id: string, isFavorite: boolean) => Promise<void>;
}

export const useTransactionStore = create<TransactionState>((set) => ({
  transactions: [],
  isLoading: false,

  fetchTransactions: async () => {
    set({ isLoading: true });
    try {
      const { data } = await apiClient.get("/transactions/");
      set({ transactions: data });
    } finally {
      set({ isLoading: false });
    }
  },

  createTransaction: async (payload) => {
    const { data } = await apiClient.post("/transactions/", payload);
    set((s) => ({ transactions: [data, ...s.transactions] }));
  },

  updateTransaction: async (id, payload) => {
    const { data } = await apiClient.put(`/transactions/${id}`, payload);
    set((s) => ({
      transactions: s.transactions.map((t) => (t.id === id ? data : t)),
    }));
  },

  deleteTransaction: async (id) => {
    await apiClient.delete(`/transactions/${id}`);
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
  },

  toggleFavorite: async (id, isFavorite) => {
    const { data } = await apiClient.patch(`/transactions/${id}/favorite`, {
      is_favorite: isFavorite,
    });
    set((s) => ({
      transactions: s.transactions.map((t) => (t.id === id ? data : t)),
    }));
  },
}));
```

**Step 2: Commit**

```bash
git add frontend/src/store/transactionStore.ts
git commit -m "feat: add toggleFavorite action to transactionStore"
```

---

### Task 8: Frontend screen — FavoritesRow + long-press menu + prefill logic

**Files:**
- Modify: `frontend/src/screens/transactions/TransactionListScreen.tsx`

This is the largest change. Apply each step carefully.

---

#### Step 1: Update `FormModalProps` to accept `prefill`

In the `FormModalProps` interface (around line 108), add the `prefill` prop:

```typescript
interface FormModalProps {
  visible: boolean;
  initial?: Transaction | null;
  prefill?: Transaction | null;       // NEW: favorite re-entry (all fields, date = today)
  initialDate?: string;
  onClose: () => void;
  onSubmit: (
    type: "income" | "expense",
    amount: string,
    description: string,
    categoryId: string,
    datetime: string,
    paymentType: string | null,
    userCardId: string | null
  ) => Promise<void>;
}
```

---

#### Step 2: Update `FormModal` function signature and `useEffect`

Change the function signature to destructure `prefill`:

```typescript
function FormModal({ visible, initial, prefill, initialDate, onClose, onSubmit }: FormModalProps) {
```

Replace the `useEffect` body (lines ~148–165) with:

```typescript
  useEffect(() => {
    if (visible) {
      // src: edit target OR favorite prefill OR null (blank)
      const src = initial ?? prefill ?? null;
      setType(src?.type === "income" ? "income" : "expense");
      setAmount(src ? String(Math.round(Number(src.amount))) : "");
      setDescription(src?.description ?? "");
      setCategoryId(src?.category_id ?? "");
      // For favorite re-entry (prefill, no initial): reset date to today
      setDatetime(
        initial
          ? toLocalDateTime(initial.transacted_at)
          : initialDate ? dateKeyToDateTime(initialDate) : nowLocalDateTime()
      );
      setPaymentType(src?.type === "expense" ? (src.payment_type ?? null) : null);
      setSelectedCardId(src?.type === "expense" ? (src.user_card_id ?? null) : null);
      setNewCardName("");
      setShowAddCard(false);
      fetchCards();
    }
  }, [visible, initial, prefill, initialDate]);
```

---

#### Step 3: Add `FavoritesRow` component

Insert this new component **before** the `// ── 메인 화면 ─────` comment (around line 431):

```typescript
// ── FavoritesRow ──────────────────────────────────────────

interface FavoritesRowProps {
  favorites: Transaction[];
  onPress: (fav: Transaction) => void;
}

function FavoritesRow({ favorites, onPress }: FavoritesRowProps) {
  const { categories } = useCategoryStore();
  if (favorites.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.favRow}
      contentContainerStyle={styles.favRowContent}
    >
      {favorites.map((fav) => {
        const category = categories.find((c) => c.id === fav.category_id);
        const typeColor = TYPE_COLORS[fav.type] ?? theme.colors.transfer;
        return (
          <TouchableOpacity
            key={fav.id}
            style={styles.favChip}
            onPress={() => onPress(fav)}
            activeOpacity={0.75}
          >
            <View style={[styles.favChipDot, { backgroundColor: category?.color ?? typeColor }]} />
            <Text style={styles.favChipLabel} numberOfLines={1}>
              {fav.description ?? category?.name ?? (fav.type === "income" ? "수입" : "지출")}
            </Text>
            <Text style={styles.favChipAmount}>
              {Math.round(Number(fav.amount)).toLocaleString("ko-KR")}원
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
```

---

#### Step 4: Add new state variables to `TransactionListScreen`

Inside `TransactionListScreen`, after the existing state declarations (around line 452), add:

```typescript
  // Favorites
  const { toggleFavorite } = useTransactionStore();
  const favorites = useMemo(
    () => transactions.filter((t) => t.is_favorite).slice(0, 10),
    [transactions]
  );
  const [contextTx, setContextTx] = useState<Transaction | null>(null);
  const [favoritePrefill, setFavoritePrefill] = useState<Transaction | null>(null);
```

---

#### Step 5: Add `openFromFavorite` and `handleToggleFavorite` handlers

After the existing `openEdit` function (around line 527), add:

```typescript
  const openFromFavorite = (fav: Transaction) => {
    setEditing(null);
    setFavoritePrefill(fav);
    setModalVisible(true);
  };

  const handleToggleFavorite = async () => {
    if (!contextTx) return;
    try {
      await toggleFavorite(contextTx.id, !contextTx.is_favorite);
    } catch (e: any) {
      Alert.alert("오류", e.response?.data?.detail ?? "즐겨찾기 변경에 실패했습니다.");
    } finally {
      setContextTx(null);
    }
  };
```

---

#### Step 6: Update `handleDelete` to warn when deleting a favorite

Replace the existing `handleDelete` (around lines 532–543) with:

```typescript
  const handleDelete = (item: Transaction) => {
    const msg = item.is_favorite
      ? "즐겨찾기에 등록된 항목입니다. 삭제하면 즐겨찾기에서도 제거됩니다."
      : "이 내역을 삭제할까요?";
    const doDelete = () => deleteTransaction(item.id);
    if (Platform.OS === "web") {
      if (window.confirm(msg)) doDelete();
    } else {
      Alert.alert("삭제", msg, [
        { text: "취소", style: "cancel" },
        { text: "삭제", style: "destructive", onPress: doDelete },
      ]);
    }
  };
```

---

#### Step 7: Add `onLongPress` to each transaction row

In the `renderItem` of the `FlatList` (around line 711), change `TouchableOpacity` to add `onLongPress`:

```typescript
            <TouchableOpacity
              style={styles.row}
              onPress={() => openEdit(item)}
              onLongPress={() => setContextTx(item)}
              delayLongPress={400}
              activeOpacity={0.7}
            >
```

---

#### Step 8: Insert `FavoritesRow` above the calendar section in the render

Inside the main `return` (around line 639), add `FavoritesRow` as the first child of the outer `View`, **before** `<View style={styles.calendarSection}>`:

```typescript
    <View style={styles.container}>
      {/* Favorites quick re-entry row */}
      <FavoritesRow favorites={favorites} onPress={openFromFavorite} />

      {/* Step 2: Calendar section (fixed top) */}
      <View style={styles.calendarSection}>
```

---

#### Step 9: Add the context menu Modal

After the `FormModal` closing tag (around line 767), add:

```typescript
      {/* Long-press context menu */}
      <Modal
        visible={!!contextTx}
        transparent
        animationType="fade"
        onRequestClose={() => setContextTx(null)}
      >
        <TouchableOpacity
          style={styles.contextOverlay}
          activeOpacity={1}
          onPress={() => setContextTx(null)}
        >
          <View style={styles.contextMenu}>
            <Text style={styles.contextTitle} numberOfLines={1}>
              {contextTx?.description ?? TYPE_LABELS[contextTx?.type ?? "expense"] ?? "거래"}
            </Text>
            <TouchableOpacity style={styles.contextOption} onPress={handleToggleFavorite}>
              <Text style={styles.contextOptionText}>
                {contextTx?.is_favorite ? "⭐ 즐겨찾기 해제" : "☆ 즐겨찾기 추가"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contextCancel}
              onPress={() => setContextTx(null)}
            >
              <Text style={styles.contextCancelText}>취소</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
```

---

#### Step 10: Update the `FormModal` invocation

Replace the `FormModal` call (around lines 760–767) with:

```typescript
      <FormModal
        visible={modalVisible}
        initial={editing}
        prefill={editing ? null : favoritePrefill}
        initialDate={editing ? undefined : (selectedDay ?? today)}
        onClose={() => {
          setModalVisible(false);
          setFavoritePrefill(null);
        }}
        onSubmit={handleSubmit}
      />
```

---

#### Step 11: Add new styles to `StyleSheet.create`

Append these styles to the existing `StyleSheet.create` call (before the closing `}`):

```typescript
  // Favorites row
  favRow: {
    backgroundColor: theme.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  favRowContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: 8,
  },
  favChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
    maxWidth: 200,
  },
  favChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  favChipLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.text.primary,
    flexShrink: 1,
  },
  favChipAmount: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    flexShrink: 0,
  },

  // Context menu
  contextOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  contextMenu: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.lg,
    width: 280,
    overflow: "hidden",
  },
  contextTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text.secondary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  contextOption: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  contextOptionText: {
    fontSize: 16,
    color: theme.colors.text.primary,
    textAlign: "center",
  },
  contextCancel: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  contextCancelText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: "center",
  },
```

---

#### Step 12: Commit

```bash
git add frontend/src/screens/transactions/TransactionListScreen.tsx
git commit -m "feat: add FavoritesRow, long-press menu, and prefill logic to TransactionListScreen"
```

---

### Task 9: Manual verification

**Checklist:**

1. Start the backend:
   ```bash
   cd backend && source .venv/bin/activate && uvicorn app.main:app --reload
   ```

2. Start the frontend:
   ```bash
   cd frontend && npx expo start --web
   ```

3. **Test 1 — Long-press context menu**
   - Go to the 거래 tab
   - Long-press any transaction row for ~400ms
   - Verify: a modal appears with "☆ 즐겨찾기 추가" and "취소"

4. **Test 2 — Add to favorites**
   - Tap "☆ 즐겨찾기 추가" in the context menu
   - Verify: context menu closes
   - Verify: a chip appears in the `FavoritesRow` above the calendar showing the transaction's description and amount

5. **Test 3 — Favorites chip tap**
   - Tap the chip
   - Verify: the input modal opens with the transaction's type, category, amount, description, and payment type pre-filled
   - Verify: the date field shows today's date (not the original transaction's date)

6. **Test 4 — Save from favorite**
   - Without changing anything, tap "저장"
   - Verify: a **new** transaction is created in the list (today's date, same fields as original)

7. **Test 5 — Remove from favorites**
   - Long-press the favorited transaction
   - Verify: context menu shows "⭐ 즐겨찾기 해제"
   - Tap it
   - Verify: chip disappears from `FavoritesRow`

8. **Test 6 — Delete a favorite**
   - Long-press a favorited transaction, close the menu
   - Tap the "삭제" button on the favorited row
   - Verify: confirmation message includes "즐겨찾기에 등록된 항목입니다"

9. **Test 7 — Maximum 10 favorites**
   - Mark 11 transactions as favorites
   - Verify: the `FavoritesRow` shows at most 10 chips (`.slice(0, 10)` in the `favorites` memo)

---

### Task 10: Final commit

```bash
git add -A
git commit -m "feat: favorites & quick re-entry — complete implementation"
```
