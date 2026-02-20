# Favorites Section UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 가로 스크롤 칩 행(FavoritesRow)을 제거하고, 거래 목록 FlatList의 ListHeaderComponent로 접을 수 있는 "자주 쓰는 거래" 섹션(FavoritesSection)으로 교체한다.

**Architecture:** 단일 파일 변경(`TransactionListScreen.tsx`). `FavoritesRow` 컴포넌트·렌더 코드·스타일을 삭제하고, `FavoritesSection` 컴포넌트와 `favExpanded` 상태를 추가한다. 기존 `row`/`typeDot`/`rowInfo`/`rowAmount` 스타일을 재사용해 거래 아이템과 동일한 레이아웃으로 즐겨찾기를 표시한다.

**Tech Stack:** React Native (Expo), TypeScript

---

### Task 1: FavoritesRow → FavoritesSection 컴포넌트 교체

**Files:**
- Modify: `frontend/src/screens/transactions/TransactionListScreen.tsx:435-474`

현재 `FavoritesRow` 컴포넌트 블록(lines 435–474)을 아래 `FavoritesSection`으로 **완전히 교체**한다.

**Step 1: FavoritesRow 블록 전체를 FavoritesSection으로 교체**

제거 대상 (lines 435–474):
```typescript
// ── FavoritesRow ──────────────────────────────────────────

interface FavoritesRowProps {
  favorites: Transaction[];
  onPress: (fav: Transaction) => void;
}

function FavoritesRow({ favorites, onPress }: FavoritesRowProps) {
  ...
}
```

교체할 코드:
```typescript
// ── FavoritesSection ──────────────────────────────────────

interface FavoritesSectionProps {
  favorites: Transaction[];
  expanded: boolean;
  onToggle: () => void;
  onPress: (fav: Transaction) => void;
}

function FavoritesSection({ favorites, expanded, onToggle, onPress }: FavoritesSectionProps) {
  const { categories } = useCategoryStore();
  if (favorites.length === 0) return null;
  return (
    <View style={styles.favSection}>
      <TouchableOpacity
        style={styles.favSectionHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.favSectionTitle}>
          <Text style={styles.favSectionTitleText}>★ 자주 쓰는 거래</Text>
          <View style={styles.favBadge}>
            <Text style={styles.favBadgeText}>{favorites.length}</Text>
          </View>
        </View>
        <Text style={styles.favToggleText}>{expanded ? "∧" : "∨"}</Text>
      </TouchableOpacity>
      {expanded && favorites.map((fav) => {
        const category = categories.find((c) => c.id === fav.category_id);
        const typeColor = TYPE_COLORS[fav.type] ?? theme.colors.transfer;
        return (
          <TouchableOpacity
            key={fav.id}
            style={styles.favItem}
            onPress={() => onPress(fav)}
            activeOpacity={0.7}
          >
            <View style={[styles.typeDot, { backgroundColor: category?.color ?? typeColor }]} />
            <View style={styles.rowInfo}>
              <Text style={styles.rowDescription} numberOfLines={1}>
                {fav.description ?? TYPE_LABELS[fav.type] ?? fav.type}
              </Text>
              {category && (
                <Text style={styles.rowCategory}>{category.name}</Text>
              )}
            </View>
            <Text style={[styles.rowAmount, { color: typeColor }]}>
              {formatAmount(fav.type, fav.amount)}
            </Text>
          </TouchableOpacity>
        );
      })}
      <View style={styles.favSectionDivider} />
    </View>
  );
}
```

---

### Task 2: 상태 추가 + 렌더 교체 + ListHeaderComponent 적용

**Files:**
- Modify: `frontend/src/screens/transactions/TransactionListScreen.tsx`

**Step 1: `favExpanded` 상태 추가**

`TransactionListScreen` 함수 내부에서 `favoritePrefill` 상태 바로 다음 줄에 추가:

```typescript
  const [favoritePrefill, setFavoritePrefill] = useState<Transaction | null>(null);
  const [favExpanded, setFavExpanded] = useState(true);  // NEW
```

**Step 2: 기존 FavoritesRow 렌더 코드 제거**

메인 `return` 안에서 아래 두 줄을 삭제한다:
```typescript
      {/* Favorites quick re-entry row */}
      <FavoritesRow favorites={favorites} onPress={openFromFavorite} />
```

**Step 3: FlatList에 `ListHeaderComponent` 추가**

현재 FlatList:
```typescript
        <FlatList
          data={listTx}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={...}
```

`ItemSeparatorComponent` 바로 위에 `ListHeaderComponent` prop 추가:
```typescript
        <FlatList
          data={listTx}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <FavoritesSection
              favorites={favorites}
              expanded={favExpanded}
              onToggle={() => setFavExpanded((prev) => !prev)}
              onPress={openFromFavorite}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={...}
```

---

### Task 3: 스타일 교체

**Files:**
- Modify: `frontend/src/screens/transactions/TransactionListScreen.tsx:1201-1240`

**Step 1: 기존 칩 스타일 블록 전체 삭제**

아래 블록(lines 1201–1240, `// Favorites row` 주석부터 `favChipAmount`까지) 삭제:
```typescript
  // Favorites row
  favRow: { ... },
  favRowContent: { ... },
  favChip: { ... },
  favChipDot: { ... },
  favChipLabel: { ... },
  favChipAmount: { ... },
```

**Step 2: 같은 위치에 새 섹션 스타일 추가**

`// Context menu` 주석 바로 앞에 삽입:
```typescript
  // Favorites section
  favSection: {
    backgroundColor: theme.colors.bg,
    marginBottom: theme.spacing.sm,
  },
  favSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  favSectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  favSectionTitleText: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.text.primary,
  },
  favBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  favBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  favToggleText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  favItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  favSectionDivider: {
    height: 8,
    backgroundColor: theme.colors.surface,
  },
```

**Step 3: Commit**

```bash
git add frontend/src/screens/transactions/TransactionListScreen.tsx
git commit -m "feat: replace FavoritesRow chips with collapsible FavoritesSection"
```

---

### Task 4: 수동 검증

앱 실행:
```bash
cd /Users/seungyoon-kim/Desktop/benefit_butler/frontend && npx expo start --web
```

**체크리스트:**
1. 즐겨찾기 0개 → "자주 쓰는 거래" 섹션이 보이지 않음
2. 즐겨찾기 1개 이상 → 섹션 헤더(`★ 자주 쓰는 거래 (N)`)와 아이템 목록 표시
3. 헤더 탭 → 섹션 접힘 (`∨` 아이콘으로 변경)
4. 다시 탭 → 펼침 (`∧` 아이콘으로 변경)
5. 아이템 탭 → 입력 모달 열림, 필드 미리 채워짐, 날짜는 오늘
6. 거래 목록을 스크롤하면 섹션도 함께 스크롤됨 (고정 아님)
7. 상단에 칩 행이 더 이상 보이지 않음
8. 최대 10개 항목만 표시 (11개 이상 즐겨찾기 시 10개까지만)
