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
  - State: `zustand`
  - HTTP: `axios`
  - Charts: `react-native-gifted-charts` + `react-native-svg`
  - Icons: `@expo/vector-icons` (Ionicons)
  - Auth Storage: `expo-secure-store` (native) / `localStorage` (web)
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
```

### 파일 구조
```
frontend/src/
├── theme.ts                          # 디자인 토큰 (색상/간격/타이포 — 모든 화면이 이 파일 참조)
├── navigation/index.tsx              # RootNavigation: Auth/Main 분기
├── screens/
│   ├── auth/        LoginScreen, RegisterScreen
│   ├── home/        HomeScreen          ← 메인 대시보드 (차트 포함)
│   ├── transactions/ TransactionListScreen  ← CRUD + 필터/섹션
│   ├── analysis/    AnalysisScreen      ← 월별 분석 차트
│   ├── settings/    SettingsScreen      ← 프로필 + 설정
│   └── categories/  CategoryListScreen  ← 설정 탭에서 push 이동
├── store/           authStore, transactionStore, categoryStore (Zustand)
├── services/api.ts  # Axios + JWT 인터셉터
└── types/index.ts   # User, Category, Transaction 인터페이스
```

### 네비게이션 구조
```
RootNavigation
├── AuthNavigator (NativeStack)  — 비로그인
│   ├── LoginScreen
│   └── RegisterScreen
└── MainNavigator (BottomTab 4탭)  — 로그인 후
    ├── 홈      → HomeScreen
    ├── 거래    → TransactionListScreen
    ├── 분석    → AnalysisScreen
    └── 설정    → SettingsNavigator (NativeStack)
                    ├── SettingsScreen
                    └── CategoryListScreen
```

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
| Excel 업로드 자동 파싱 | ⬜ 미구현 |
| SMS/푸시 실시간 파싱 | ⬜ 미구현 |
| 카드 실적 트래커 | ⬜ 미구현 |
| 카드 추천 알고리즘 | ⬜ 미구현 |
| 소셜 로그인 (카카오/구글) | ⬜ 미구현 |

## 🛠 Development Guidelines
- **Cross-Platform First**: 플랫폼 간 UI 일관성을 유지하되, iOS/Android 특화 기능(알림 접근 등)은 인터페이스화하여 분리
- **Data Integrity**: 엑셀 업로드 시 중복 데이터 체크 로직 필수
- **Performance**: 대량의 결제 내역 조회 및 카드 추천 연산 최적화
- **Privacy**: 사용자의 SMS/푸시 내역 중 결제 관련 정보만 선택적으로 수집 및 처리
