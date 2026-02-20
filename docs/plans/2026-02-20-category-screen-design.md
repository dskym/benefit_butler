# Category Screen Design Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 카테고리 관리 화면의 섹션 헤더 레이아웃 수정, 아이콘 버튼 도입, 기본 카테고리 뱃지, 색상 팔레트 picker로 디자인을 정리한다.

**Architecture:** `CategoryListScreen.tsx` 단일 파일만 수정한다. Ionicons(`@expo/vector-icons`) 아이콘으로 텍스트 버튼을 대체하고, 인라인 색상 팔레트 컴포넌트를 FormModal 안에 추가한다. 백엔드·스토어·타입 변경 없음.

**Tech Stack:** React Native (Expo), TypeScript, `@expo/vector-icons` (Ionicons)

---

### Task 1: Ionicons import 추가 + 섹션 헤더 레이아웃 수정

**Files:**
- Modify: `frontend/src/screens/categories/CategoryListScreen.tsx`

현재 섹션 헤더는 `justifyContent: "space-between"`에 dot·label·count가 나란히 있어 dot과 label 사이가 벌어진다. dot+label을 `<View>`로 묶고, Ionicons import를 추가한다.

**Step 1: 파일 상단 import에 Ionicons 추가**

기존:
```tsx
import { theme } from "../../theme";
```

변경 후:
```tsx
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";
```

**Step 2: `renderSectionHeader`를 아래로 교체**

기존:
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

변경 후:
```tsx
renderSectionHeader={({ section }) => (
  <View style={styles.sectionHeaderRow}>
    <View style={styles.sectionHeaderLeft}>
      <View style={[styles.sectionDot, { backgroundColor: TYPE_COLORS[section.type] }]} />
      <Text style={styles.sectionLabel}>{section.title}</Text>
    </View>
    <Text style={[
      styles.sectionCount,
      section.data.length >= 30 && { color: theme.colors.expense },
    ]}>
      {section.data.length}/30
    </Text>
  </View>
)}
```

**Step 3: StyleSheet에 `sectionHeaderLeft` 추가**

`sectionHeaderRow` 스타일 바로 아래에 추가:
```ts
sectionHeaderLeft: {
  flexDirection: "row",
  alignItems: "center",
},
```

---

### Task 2: 수정/삭제 텍스트 버튼 → 아이콘 버튼 + 기본 카테고리 뱃지

**Files:**
- Modify: `frontend/src/screens/categories/CategoryListScreen.tsx`

**Step 1: `renderItem` 내부 rowActions 블록을 교체**

기존:
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

변경 후:
```tsx
{item.is_default ? (
  <View style={styles.defaultBadge}>
    <Text style={styles.defaultBadgeText}>기본</Text>
  </View>
) : (
  <View style={styles.rowActions}>
    <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(item)}>
      <Ionicons name="pencil-outline" size={18} color={theme.colors.primary} />
    </TouchableOpacity>
    <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(item)}>
      <Ionicons name="trash-outline" size={18} color={theme.colors.expense} />
    </TouchableOpacity>
  </View>
)}
```

**Step 2: StyleSheet에서 기존 텍스트 버튼 스타일 교체**

기존 스타일 4개:
```ts
rowActions: { flexDirection: "row", gap: 4 },
editBtn: { paddingHorizontal: 8, paddingVertical: 4 },
editBtnText: { color: theme.colors.primary, fontSize: 13 },
deleteBtn: { paddingHorizontal: 8, paddingVertical: 4 },
deleteBtnText: { color: theme.colors.expense, fontSize: 13 },
```

변경 후 (5개 → 4개):
```ts
rowActions: { flexDirection: "row", alignItems: "center", gap: 2 },
iconBtn: { padding: 6 },
defaultBadge: {
  paddingHorizontal: 8,
  paddingVertical: 3,
  borderRadius: 10,
  backgroundColor: theme.colors.surface,
  borderWidth: 1,
  borderColor: theme.colors.border,
},
defaultBadgeText: {
  fontSize: 11,
  color: theme.colors.text.hint,
  fontWeight: "500" as const,
},
```

---

### Task 3: FormModal 색상 입력 → 팔레트 picker

**Files:**
- Modify: `frontend/src/screens/categories/CategoryListScreen.tsx`

**Step 1: `COLOR_PALETTE` 상수를 파일 상단(TYPE_ORDER 아래)에 추가**

```tsx
const COLOR_PALETTE: string[] = [
  "#F04452", "#F97316", "#F59E0B", "#EAB308", "#84CC16", "#22C55E", "#0D9488",
  "#06B6D4", "#3182F6", "#6366F1", "#8B5CF6", "#A855F7", "#EC4899", "#F43F5E",
  "#94A3B8", "#8B95A1", "#64748B", "#374151", "#78716C", "#57534E", "#1E293B",
];
```

**Step 2: FormModal 내 색상 입력 블록 교체**

기존 (`<Text style={styles.label}>색상 (hex)</Text>` 부터 `</View>` 까지):
```tsx
<Text style={styles.label}>색상 (hex)</Text>
<View style={styles.colorRow}>
  <View style={[styles.colorPreview, { backgroundColor: color }]} />
  <TextInput
    style={[styles.input, styles.colorInput]}
    value={color}
    onChangeText={setColor}
    placeholder="#6366f1"
    autoCapitalize="none"
    placeholderTextColor={theme.colors.text.hint}
  />
</View>
```

변경 후:
```tsx
<Text style={styles.label}>색상</Text>
<View style={styles.paletteGrid}>
  {COLOR_PALETTE.map((c) => (
    <TouchableOpacity
      key={c}
      style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchSelected]}
      onPress={() => setColor(c)}
      activeOpacity={0.8}
    >
      {color === c && <Ionicons name="checkmark" size={14} color="#fff" />}
    </TouchableOpacity>
  ))}
</View>
```

**Step 3: StyleSheet에서 불필요한 스타일 제거 후 팔레트 스타일 추가**

제거할 스타일:
```ts
colorRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
colorPreview: { width: 36, height: 36, borderRadius: theme.radius.sm },
colorInput: { flex: 1 },
```

추가할 스타일:
```ts
paletteGrid: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 4,
},
swatch: {
  width: 36,
  height: 36,
  borderRadius: 18,
  alignItems: "center",
  justifyContent: "center",
},
swatchSelected: {
  borderWidth: 3,
  borderColor: "rgba(0,0,0,0.25)",
},
```

---

### Task 4: 커밋

**Step 1: 변경 파일 스테이징 및 커밋**

```bash
git add frontend/src/screens/categories/CategoryListScreen.tsx \
        docs/plans/2026-02-20-category-screen-design.md
git commit -m "design: polish category management screen"
```
