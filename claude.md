# Benefit Butler

사용자의 금융 생활을 자동화하고, 보유한 카드의 혜택을 극대화할 수 있도록 돕는 통합 자산 관리 솔루션입니다.
회원별 데이터 동기화를 통해 iOS, Android 및 향후 Web 환경까지 지원합니다.

## 🚀 Project Vision
- **Seamless Integration**: 회원가입 한 번으로 기기 간 데이터 동기화 및 자산 관리
- **Zero Effort**: 엑셀 업로드와 실시간 알림 파싱을 통한 수기 입력 최소화
- **Smart Spending**: 실적 기반 카드 추천 알고리즘을 통한 소비 최적화

## 🛠 Tech Stack
- **Frontend**: React Native (Expo SDK 54) — iOS/Android/Web 대응
  - Navigation: `@react-navigation/native`, `@react-navigation/bottom-tabs`, `@react-navigation/native-stack`
  - State: `zustand` (persist middleware로 로컬 영속화)
  - HTTP: `axios`
  - Charts: `react-native-gifted-charts` + `react-native-svg`
  - Icons: `@expo/vector-icons` (Ionicons)
  - Auth Storage: `expo-secure-store` (native) / `localStorage` (web)
  - Offline Storage: `react-native-mmkv` (AES 암호화, native only) / `@react-native-async-storage/async-storage` (web fallback + Push 임포트 IPC)
  - Network: `@react-native-community/netinfo` (연결 상태 감지)
  - SMS Import (Android): `react-native-get-sms-android` (CommonJS 직접 export — `.default` 없이 사용)
  - Push Import (Android): `react-native-notification-listener` (Headless JS 방식 — `addListener` 아님)
- **Backend**: Python (FastAPI)
- **Database**: PostgreSQL (회원 정보, 결제 내역, 카드 메타데이터 관리)
- **Auth**: JWT 기반 인증 (OAuth2.0 카카오/구글 소셜 로그인 권장)
- **Parsing**: `xlsx` (Excel), 정규표현식 및 LLM 기반 알림 텍스트 분석

## 📋 Core Features

### 1. User & Membership (Core)
- **Authentication**: 이메일 및 소셜 로그인, JWT 기반 토큰 인증
- **Profile & Sync**: 사용자별 소비 카테고리 설정, 목표 예산 설정, 기기 간 데이터 실시간 동기화

### 2. Basic Ledger (Core)
- **Transaction Management**: 수입/지출/이체 내역 기록, 수정 및 삭제
- **Category & Tagging**: 식비, 교통, 주거 등 커스텀 카테고리 관리
- **Dashboards**: 월별/일별 지출 현황 시각화, 카테고리별 지출 통계 보고서

### 3. Smart Automation
- **Bulk Data Import**: 타 가계부 서비스/은행에서 내보낸 Excel 파일 업로드 시 필드 매핑 및 자동 저장
- **Real-time Ingestion**:
    - Android: SMS 수신 시 브로드캐스트 리시버를 통한 즉시 파싱
    - iOS/Android: 앱 푸시 알림(금융 앱) 내역을 읽어 가맹점, 금액, 일시 자동 추출
- **Parsing Engine**: 다양한 포맷의 문자를 정형 데이터로 변환하는 파싱 로직

### 4. Card Performance & Recommendation (Edge)
- **Card Performance Tracker**: 
    - 사용자가 보유한 카드 등록 및 카드별 전월 실적 조건 설정
    - 실시간 지출 내역과 연동하여 현재 실적 달성 현황 및 잔여 필요 금액 표시
- **Merchant-Card Matching**:
    - 가맹점 검색 또는 결제 전 쿼리 시, 해당 업종에서 가장 높은 혜택을 제공하는 보유 카드 추천
    - '실적 충족까지 얼마 남지 않은 카드'를 우선 추천하는 지능형 로직 적용

## 🗂 Frontend Architecture

### 실행
```bash
cd frontend && npx expo start --web   # 웹 개발
cd frontend && npx expo start         # 네이티브 (Expo Go)
cd frontend && npm run android        # Android dev build (expo run:android)
cd frontend && npm run ios            # iOS dev build (expo run:ios)
```

> ⚠️ **Native Module 주의**: `react-native-mmkv`, `react-native-get-sms-android`, `react-native-notification-listener`는 모두 native module이므로 Expo Go에서 동작하지 않음.
> SMS/푸시 자동 임포트 포함 네이티브 개발 시 반드시 개발 빌드 사용:
> ```bash
> cd frontend && npx expo prebuild --platform android --clean && npx expo run:android
> ```
> Android SDK 경로 설정 필요 시: `frontend/android/local.properties`에 `sdk.dir=/Users/<username>/Library/Android/sdk` 추가

### 파일 구조
```
frontend/src/
├── theme.ts                          # 디자인 토큰 (색상/간격/타이포 — 모든 화면이 이 파일 참조)
├── navigation/index.tsx              # RootNavigation: Auth/Main 분기 + OfflineBanner
├── screens/
│   ├── auth/        LoginScreen, RegisterScreen
│   ├── home/        HomeScreen          ← 메인 대시보드 (차트 포함)
│   ├── transactions/ TransactionListScreen  ← CRUD + 필터/섹션 + 오프라인 지원
│   ├── analysis/    AnalysisScreen      ← 월별 분석 차트 + 카드별 실적 섹션
│   │                CardPerformanceScreen ← 카드 상세 실적 + 기간별 거래 목록
│   ├── benefit/     CardRecommendScreen  ← 가맹점별 최적 카드 추천
│   │                CardBenefitEditScreen ← 카드 혜택 CRUD (카탈로그 연동)
│   ├── settings/    SettingsScreen      ← 프로필 + 설정
│   │                CardListScreen      ← 카드 추가/편집 (monthly_target, billing_day)
│   └── categories/  CategoryListScreen  ← 설정 탭에서 push 이동
├── store/
│   ├── authStore.ts              # persist + 오프라인 시 캐시 유저 유지
│   ├── transactionStore.ts       # persist + 오프라인 낙관적 업데이트 (toggleFavorite 포함)
│   ├── categoryStore.ts          # persist
│   ├── cardStore.ts              # 카드 CRUD (billing_day, monthly_target 포함)
│   ├── cardPerformanceStore.ts   # persist + GET /cards/performance 캐싱 (오프라인 stale 유지)
│   ├── cardBenefitStore.ts       # persist + 카드별 혜택 CRUD (user_card_benefits)
│   ├── recommendStore.ts         # 카드 추천 결과 (persist 없음, 매회 재계산)
│   ├── financialImportStore.ts   # SMS/푸시 임포트 상태 (isSmsEnabled, isPushEnabled, dedup, persist)
│   ├── pendingMutationsStore.ts  # 오프라인 FIFO 큐 (MMKV 영속) + retryCount + incrementRetry
│   └── syncStatusStore.ts        # 동기화 상태 (isSyncing, lastSyncAt persist, syncError)
├── storage/index.ts              # MMKV 초기화 + SecureStore 암호화 키 + Zustand adapter
├── hooks/
│   ├── useNetworkStatus.ts       # NetInfo 래퍼 (isOnline 상태)
│   ├── useSmsAutoImport.android.ts   # Android SMS 읽기 → 파싱 → 거래 생성
│   └── usePushAutoImport.android.ts  # Android AsyncStorage pending 항목 처리 → 거래 생성
├── services/
│   ├── api.ts                    # Axios + JWT 인터셉터
│   ├── syncService.ts            # 오프라인 큐 재전송: 재시도 전략 + syncStatusStore 연동
│   └── headlessNotificationHandler.ts  # Android Headless JS: 알림 파싱 → AsyncStorage 저장
├── utils/
│   ├── smsParser.ts              # parseFinancialMessage() + buildDedupKey() — SMS/푸시 공용
│   └── financialAppPackages.ts   # 금융앱 패키지명 화이트리스트
├── components/OfflineBanner.tsx  # 오프라인(주황)/동기화 중(파랑) 두 상태 구분 배너
└── types/index.ts                # User, Category, Transaction, PendingMutation 인터페이스
```

### 네비게이션 구조
```
RootNavigation
├── AuthNavigator (NativeStack)  — 비로그인
│   ├── LoginScreen
│   └── RegisterScreen
└── MainNavigator (BottomTab 4탭)  — 로그인 후
    ├── 가계부  → TransactionListScreen
    ├── 분석    → AnalysisNavigator (NativeStack)
    │               ├── AnalysisMain (AnalysisScreen)
    │               └── CardPerformance (CardPerformanceScreen)
    ├── 혜택    → BenefitNavigator (NativeStack)
    │               ├── CardRecommend (CardRecommendScreen)
    │               └── CardBenefitEdit (CardBenefitEditScreen)
    └── 설정    → SettingsNavigator (NativeStack)
                    ├── SettingsScreen
                    ├── CategoryListScreen
                    ├── CardListScreen
                    └── PrivacyPolicyScreen
```

### 오프라인 아키텍처

#### 동기화 재시도 전략 (`syncService.ts`)
| 에러 종류 | 처리 방식 |
|-----------|-----------|
| 4xx (400, 404 등) | 즉시 큐에서 제거 (영구 실패, 재시도 불가) |
| 5xx / 네트워크 오류 | `incrementRetry`. `retryCount ≥ 3`이면 제거, 아니면 flush 중단 (FIFO 순서 보장) |
| 401/403 | flush 전체 중단 (인증 오류 — 재로그인 필요) |

#### 카테고리 오프라인 정책
- 카테고리 mutation(CREATE/UPDATE/DELETE)은 **오프라인 큐 미지원** — 트랜잭션이 오프라인 카테고리 ID를 참조하면 sync 순서 보장 불가
- 오프라인 상태에서 mutation 시도 시 `Alert`으로 명확한 안내 메시지 표시

#### 동기화 상태 (`syncStatusStore.ts`)
- `isSyncing`: flush 진행 중 여부 (UI 비활성화용)
- `lastSyncAt`: 마지막 성공 시각 (persist — 앱 재시작 후에도 유지)
- `syncError`: 마지막 실패 메시지 (다음 성공 시 자동 초기화)

#### `toggleFavorite` 오프라인 지원
- 오프라인: 낙관적 업데이트(`is_favorite`, `_isPending: true`) + `TOGGLE_FAVORITE` 큐 enqueue
- 온라인 성공: `_isPending: false`
- 온라인 실패: `is_favorite` 원복 + throw

### SMS/푸시 자동 임포트 아키텍처 (Android)

#### SMS 임포트 흐름
1. `useSmsAutoImport` (마운트 시, `isSmsEnabled` 변경 시 실행)
2. `PermissionsAndroid.request(READ_SMS)` 권한 요청
3. `react-native-get-sms-android` — SMS inbox 읽기 (`minDate` 기준)
4. `parseFinancialMessage()` — 금융 SMS 파싱
5. dedup 체크 (`importedSmsIds` + `dedupSignatures`) 후 `createTransaction()`
6. `financialImportStore`에 처리된 ID·dedup 서명 저장

#### 푸시 임포트 흐름 (Headless JS 방식)
1. **백그라운드**: Android가 알림 수신 시 `RNAndroidNotificationListenerHeadlessJs` Headless task 실행
2. `headlessNotificationHandler` — `FINANCIAL_APP_PACKAGES` 필터 → `parseFinancialMessage()` → AsyncStorage(`@benefit_butler/pending_push`)에 저장
3. **포그라운드**: `usePushAutoImport`가 마운트 시 + `AppState active` 이벤트 시 AsyncStorage에서 pending 항목 처리 → `createTransaction()`
4. 처리된 항목은 AsyncStorage에서 제거, dedup 서명 저장

#### dedup 키 형식
```
`${amount}:${description}:${Math.floor(tsMs / 300000)}`
```
5분 버킷 단위로 동일 거래를 SMS/푸시 중복 없이 1번만 생성.

#### 주요 주의사항
- `react-native-notification-listener`의 실제 API: `getPermissionStatus()` / `requestPermission()` (`.isPermitted()` / `.addListener()` 아님)
- `react-native-get-sms-android`는 CommonJS export — `require()` 직접 사용, `.default` 없음
- Android 10+ `adb shell content insert`로 SMS inbox 직접 삽입 불가 (권한 차단)

### 디자인 시스템
- **Primary**: `#3182F6` (토스 블루)
- **Income**: `#22C55E` / **Expense**: `#F04452` / **Transfer**: `#8B95A1`
- 모든 색상/간격/타이포는 `src/theme.ts`에서 중앙 관리
- 카드 `borderRadius: 16`, 배경 `#FFFFFF`, 서피스 `#F8F9FA`

### 환경변수
```
EXPO_PUBLIC_API_URL=http://localhost:8000   # 백엔드 API 베이스 URL
```

## ✅ 구현 현황

| 기능 | 상태 |
|------|------|
| 이메일 회원가입 / 로그인 (JWT) | ✅ 완료 |
| 거래 내역 CRUD | ✅ 완료 |
| 카테고리 CRUD | ✅ 완료 |
| 홈 대시보드 (요약 카드 + 차트) | ✅ 완료 |
| 분석 화면 (월별 차트 + 지출 순위) | ✅ 완료 |
| 설정 화면 (프로필 + 카테고리 관리) | ✅ 완료 |
| AI 자동 카테고리 분류 (가맹점명 기반) | ✅ 완료 |
| 오프라인 지원 (MMKV 캐싱 + 낙관적 업데이트 + 펜딩 큐 자동 동기화) | ✅ 완료 |
| 오프라인 퍼스트 완성 (재시도 전략 + toggleFavorite 오프라인 + 동기화 상태 UI + 카테고리 가드) | ✅ 완료 |
| Excel 업로드 자동 파싱 | ⬜ 미구현 |
| SMS/푸시 실시간 파싱 (Android) | ✅ 완료 |
| 카드 실적 트래커 (billing_day 기반 집계 기간 + 상세 화면) | ✅ 완료 |
| 카드 추천 알고리즘 (카탈로그 + 혜택 CRUD + 가맹점별 최적 카드 추천) | ✅ 완료 |
| 소셜 로그인 (카카오/구글) | ⬜ 미구현 |

## 🧪 Testing

**모든 기능 구현 시 반드시 테스트 코드를 함께 작성한다.**

### Frontend (React Native / Expo)

```bash
cd frontend && npm test          # 전체 테스트 실행
cd frontend && npm test -- --watchAll=false  # CI 모드
```

- **도구**: `jest-expo` (프리셋) + `@types/jest` + `@testing-library/react-native`
- **위치**: `frontend/src/__tests__/` 하위에 미러 구조로 작성
  - `__tests__/store/` — Zustand store 단위 테스트
  - `__tests__/services/` — API 서비스 단위 테스트
  - `__tests__/storage/` — Storage 추상화 단위 테스트
  - `__tests__/hooks/` — Custom hook 단위 테스트 (`renderHook` 사용)
- **원칙**:
  - Store 테스트 시 `apiClient`를 `jest.mock('../../services/api')`로 완전히 모킹
  - `persist` middleware 사용 store 테스트 시 `createPlatformStorage` 추가 모킹 필수:
    ```typescript
    jest.mock('../../storage', () => ({
      mmkvStorage: { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() },
      createPlatformStorage: jest.fn(() => ({
        getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn(),
      })),
    }));
    ```
  - 각 테스트 전 `useXxxStore.setState(초기값)` + `jest.clearAllMocks()`으로 상태 초기화
  - 성공 케이스 + 실패 케이스(에러 전파 / `isLoading` 리셋) 모두 작성
  - Hook 테스트: `@testing-library/react-native`의 `renderHook` + `act` 사용 (react-hooks 라이브러리 React 19 미지원)
  - `syncStatusStore` 등 `createPlatformStorage`만 사용하는 store 테스트 시 축약 mock 가능:
    ```typescript
    jest.mock('../../storage', () => ({
      createPlatformStorage: jest.fn(() => ({
        getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn(),
      })),
    }));
    ```
  - `syncService` 테스트 시 `usePendingMutationsStore`, `useTransactionStore`, `useSyncStatusStore` 모두 모킹 필수. `syncService['_isFlushing'] = false`로 re-entrancy 초기화
  - `usePushAutoImport` 등 AsyncStorage 사용 hook 테스트 시 `@react-native-async-storage/async-storage` 모킹 필수:
    ```typescript
    jest.mock('@react-native-async-storage/async-storage', () => ({
      getItem: jest.fn().mockResolvedValue(null),
      setItem: jest.fn().mockResolvedValue(undefined),
      removeItem: jest.fn().mockResolvedValue(undefined),
    }));
    ```
  - `react-native-notification-listener`는 CommonJS export (no `__esModule`/`default`):
    ```typescript
    jest.mock('react-native-notification-listener', () => ({
      getPermissionStatus: jest.fn().mockResolvedValue('authorized'),
      requestPermission: jest.fn(),
    }));
    ```
  - `react-native-get-sms-android`도 CommonJS export — mock 시 `default` 래퍼 불필요:
    ```typescript
    jest.mock('react-native-get-sms-android', () => ({ list: jest.fn() }));
    ```

### Backend (FastAPI / Python)

```bash
cd backend && python -m pytest tests/ -v   # 전체 테스트 실행
```

- **도구**: `pytest` + `testcontainers[postgres]`
- **위치**: `backend/tests/` — `test_<도메인>.py` 파일 단위로 작성
- **테스트 DB**: `postgres:16-alpine` 컨테이너를 세션 시작 시 자동 생성 후 종료 시 제거
  - 사전 DB 생성 불필요 — Docker만 실행되어 있으면 됨
  - 테스트 격리: 각 테스트 종료 후 모든 테이블 DELETE
- **원칙**:
  - `TestClient`로 실제 HTTP 엔드포인트 호출 (통합 테스트)
  - 성공 케이스, 에러 케이스(404/400/401/403), 유저 간 데이터 격리 모두 검증
  - `conftest.py`의 `registered_user` / `auth_headers` fixture 활용
- **테스트 의존성 설치**:
  ```bash
  pip install -r backend/requirements-test.txt
  ```

### 공통 원칙

- 새 기능·버그 수정 시 **구현과 테스트를 같은 PR에 포함**
- 테스트 없이 머지하지 않는다
- 실패 케이스(경계값, 권한 오류, 존재하지 않는 리소스)를 반드시 커버

## 🌿 Git Workflow

- **main 브랜치에 직접 커밋하지 않는다** — 모든 변경사항은 feature 브랜치에서 작업 후 PR을 통해 머지
- 브랜치명 형식: `feature/<작업명>`, `fix/<버그명>`, `docs/<문서명>`
- PR 없이 main에 push하지 않는다
- **PR을 main에 머지할 때는 반드시 사용자의 명시적 승인을 받은 후 진행한다**

## 🛠 Development Guidelines
- **Cross-Platform First**: 플랫폼 간 UI 일관성을 유지하되, iOS/Android 특화 기능(알림 접근 등)은 인터페이스화하여 분리
- **Data Integrity**: 엑셀 업로드 시 중복 데이터 체크 로직 필수
- **Performance**: 대량의 결제 내역 조회 및 카드 추천 연산 최적화
- **Privacy**: 사용자의 SMS/푸시 내역 중 결제 관련 정보만 선택적으로 수집 및 처리
