# Benefit Butler

사용자의 금융 생활을 자동화하고 카드 혜택을 극대화하는 통합 자산 관리 앱 (React Native + FastAPI + PostgreSQL).

## Tech Stack
- **Frontend**: React Native (Expo SDK 54), zustand, axios, react-native-gifted-charts
- **Backend**: Python (FastAPI), PostgreSQL, JWT 인증
- **Excel**: `openpyxl` (XLSX) + `xlrd` (XLS 97-2003)
- **Native Modules (Android only, Expo Go 불가)**:
  - `react-native-mmkv` — 오프라인 스토리지 (AES 암호화)
  - `react-native-get-sms-android` — CommonJS 직접 export (`.default` 없이 사용)
  - `react-native-notification-listener` — Headless JS 방식 (`getPermissionStatus()` / `requestPermission()` API, `.isPermitted()` / `.addListener()` 아님)

## 실행
```bash
cd frontend && npx expo start --web                    # 웹 개발
cd frontend && npx expo start                          # 네이티브 (Expo Go)
cd frontend && npx expo prebuild --platform android --clean && npx expo run:android  # Android dev build
cd backend && uvicorn app.main:app --reload            # 백엔드
```

## 파일 구조
```
frontend/src/
├── theme.ts                    # 디자인 토큰 (Primary #3182F6, Income #22C55E, Expense #F04452, Transfer #8B95A1)
├── navigation/index.tsx        # Auth/VerifyEmail/Main 3분기 + OfflineBanner
├── screens/
│   ├── auth/         LoginScreen, RegisterScreen, VerifyEmailScreen
│   ├── dashboard/    DashboardScreen
│   ├── transactions/ TransactionListScreen (CRUD + 필터 + 오프라인)
│   ├── analysis/     AnalysisScreen, CardPerformanceScreen
│   ├── benefit/      CardRecommendScreen, CardBenefitEditScreen
│   ├── settings/     SettingsScreen, CardListScreen, ImportScreen, ExportScreen, PrivacyPolicyScreen
│   └── categories/   CategoryListScreen
├── store/            # zustand stores (auth, transaction, category, card, cardPerformance, cardBenefit, recommend, excelImport, financialImport, pendingMutations, syncStatus)
├── storage/index.ts  # MMKV + SecureStore 암호화 키 + Zustand adapter
├── hooks/            # useNetworkStatus, useSmsAutoImport.android, usePushAutoImport.android
├── services/         # api.ts (Axios+JWT), syncService.ts, headlessNotificationHandler.ts
├── utils/            # smsParser.ts, financialAppPackages.ts, categoryKeywords.ts
├── components/       # OfflineBanner.tsx
└── types/index.ts
```

### 네비게이션
```
RootNavigation
├── AuthNavigator (NativeStack) — 비로그인: Login, Register
├── VerifyEmailScreen — 로그인 + 이메일 미인증
└── MainNavigator (BottomTab 4탭) — 인증 완료 후
    ├── 가계부 → TransactionListScreen
    ├── 분석   → AnalysisNavigator (AnalysisMain, CardPerformance)
    ├── 혜택   → BenefitNavigator (CardRecommend, CardBenefitEdit)
    └── 설정   → SettingsNavigator (Settings, CategoryList, CardList, Import, Export, PrivacyPolicy)
```

## 주요 아키텍처 결정

### 오프라인
- 동기화 재시도: 4xx → 즉시 제거, 5xx → 최대 3회 재시도, 401/403 → flush 중단
- 카테고리 mutation은 오프라인 큐 미지원 (sync 순서 보장 불가)
- `toggleFavorite`: 낙관적 업데이트 + `TOGGLE_FAVORITE` 큐

### SMS/푸시 (Android)
- SMS: `useSmsAutoImport` → READ_SMS 권한 → inbox 읽기 → `parseFinancialMessage()` → `createTransaction()`
- 푸시: 백그라운드 Headless JS → AsyncStorage 저장 → 포그라운드 `usePushAutoImport`가 처리
- dedup 키: `${amount}:${description}:${Math.floor(tsMs / 300000)}` (5분 버킷)

### 카드 실적 트래커
- `billing_day` (1~28) 기반 집계 기간: `offset = 14 - billing_day`
- `GET /cards/performance`, `GET /transactions/?card_id=&from=&to=` (Python 예약어 회피 `alias`)

### Excel 가져오기
- 3단계: upload/preview → 매핑 확인 → confirm (중복 검사 포함)
- 헤더 자동 매핑: 날짜/금액/내역/유형/카테고리/결제수단/카드명

## Testing

**모든 기능 구현 시 반드시 테스트 코드를 함께 작성한다.**

### Frontend
```bash
cd frontend && npm test -- --watchAll=false
```
- `jest-expo` + `@testing-library/react-native`, 위치: `frontend/src/__tests__/`
- Store 테스트: `jest.mock('../../services/api')` + `useXxxStore.setState(초기값)` + `jest.clearAllMocks()`
- persist store mock:
  ```typescript
  jest.mock('../../storage', () => ({
    mmkvStorage: { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() },
    createPlatformStorage: jest.fn(() => ({
      getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn(),
    })),
  }));
  ```
- Hook 테스트: `renderHook` + `act` 사용
- `syncService` 테스트: 3개 store 모두 모킹 + `syncService['_isFlushing'] = false`
- Native module mock:
  ```typescript
  jest.mock('react-native-get-sms-android', () => ({ list: jest.fn() }));
  jest.mock('react-native-notification-listener', () => ({
    getPermissionStatus: jest.fn().mockResolvedValue('authorized'), requestPermission: jest.fn(),
  }));
  jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue(undefined), removeItem: jest.fn().mockResolvedValue(undefined),
  }));
  ```

### Backend
```bash
cd backend && python -m pytest tests/ -v
pip install -r backend/requirements-test.txt
```
- `pytest` + `testcontainers[postgres]` (postgres:16-alpine, Docker만 실행되면 됨)
- 각 테스트 후 모든 테이블 DELETE, `conftest.py`의 `registered_user` / `auth_headers` fixture 활용

## Git Workflow
- **main 브랜치에 직접 커밋하지 않는다** — feature 브랜치 → PR → 머지
- 브랜치명: `feature/<작업명>`, `fix/<버그명>`, `docs/<문서명>`
- **PR 머지 시 반드시 사용자의 명시적 승인 필요**

## Development Guidelines
- Cross-Platform First: 플랫폼별 특화 기능은 인터페이스화하여 분리
- 환경변수: `EXPO_PUBLIC_API_URL=http://localhost:8000`
