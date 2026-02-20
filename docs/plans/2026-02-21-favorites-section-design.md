# 즐겨찾기 섹션 UI 리디자인

**Goal:** 가로 스크롤 칩 행(FavoritesRow)을 제거하고, 거래 목록 상단에 접을 수 있는 "자주 쓰는 거래" 섹션으로 교체한다.

**Rationale:** 캘린더 기반 가계부 화면과 앱 스타일 칩 행의 시각적 불일치 해소.

---

## 화면 구조

```
[캘린더 고정 영역]
  - 월 네비게이터
  - 요일 헤더 + 날짜 그리드
  - 요약 바 (날짜 · 수입 · 지출)

[FlatList]
  ListHeaderComponent:
    FavoritesSection (즐겨찾기 0개면 null)
      - 토글 헤더: "★ 자주 쓰는 거래 (N)  [∧/∨]"
      - 펼침 시: 최대 10개 아이템 (거래 행 스타일)

  거래 내역 아이템들 (기존)
```

## 컴포넌트 설계

### FavoritesSection

```typescript
interface FavoritesSectionProps {
  favorites: Transaction[];       // 최대 10개, transfer 제외
  expanded: boolean;
  onToggle: () => void;
  onPress: (fav: Transaction) => void;
}
```

- `favorites.length === 0` 이면 `null` 반환
- 헤더: `★ 자주 쓰는 거래` + 카운트 뱃지 + `∧/∨` 토글
- 아이템: 기존 `row` / `typeDot` / `rowInfo` / `rowAmount` 스타일 재사용
- 아이템당 레이아웃: `[컬러 도트] [설명 / 카테고리]  [±금액]`

## 데이터

- `favorites`: `transactions.filter(t => t.is_favorite && t.type !== "transfer").slice(0, 10)`
- 최대 10개 제한
- transfer 타입 제외 (입력 모달이 income/expense만 지원)

## 상태

| 변수 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `favExpanded` | `boolean` | `true` | 섹션 접힘/펼침 (세션 유지) |

## 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/screens/transactions/TransactionListScreen.tsx` | FavoritesRow 제거, FavoritesSection 추가, ListHeaderComponent 적용, 스타일 교체 |

## 스타일 가이드

- 섹션 배경: `theme.colors.bg` (#FFFFFF)
- 헤더 패딩: `theme.spacing.md` (16px) 좌우, 12px 상하
- 헤더 타이틀: 14px, weight 700, `text.primary`
- 카운트 뱃지: `primary` 배경, 흰색 텍스트, radius 10px
- 아이템: 기존 `row` 스타일 재사용 (14px 세로 패딩)
- 섹션 하단 구분선: 1px `border` + `spacing.sm` margin
