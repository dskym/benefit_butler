# 이메일 인증 기능 설계

## 목적

- 허위 이메일 가입 방지 (스팸 차단)
- 비밀번호 재설정 등 후속 기능의 기반

## 핵심 결정

| 항목 | 결정 |
|------|------|
| 인증 시점 | 가입 직후 필수 (인증 전 앱 사용 불가) |
| 인증 방식 | 6자리 숫자 코드 입력 |
| 코드 저장 | DB 테이블 (`email_verifications`) |
| 이메일 발송 | 추상화 인터페이스 + Gmail SMTP 구현체 |
| 기존 유저 | `is_email_verified = true`로 마이그레이션 (영향 없음) |

## 데이터 모델

### User 모델 변경

`is_email_verified` 필드 추가 (기본값 `False`).

```python
is_email_verified = Column(Boolean, default=False, nullable=False)
```

Alembic 마이그레이션에서는 `server_default=true`로 설정하여 기존 유저에 영향 없도록 처리.
코드에서 신규 가입 시 `False`로 명시 설정.

### email_verifications 테이블 (신규)

```
email_verifications
├── id              UUID PK
├── user_id         UUID FK → users.id
├── code            String(6)       # "482917" 같은 6자리 숫자
├── expires_at      DateTime(UTC)   # 생성 시각 + 10분
├── attempts        Integer(0)      # 입력 시도 횟수 (최대 5회)
├── is_used         Boolean(False)  # 인증 완료 시 True
├── created_at      DateTime(UTC)
```

### 정책

- 코드 유효시간: 10분
- 최대 시도 횟수: 5회 (초과 시 재발송 필요)
- 재발송 쿨다운: 60초 (스팸 방지)
- 만료된 레코드: 인증 완료 시 해당 유저의 이전 레코드 lazy delete

## 인증 흐름

```
[가입] POST /auth/register
  → User 생성 (is_email_verified=False)
  → 인증코드 생성 + 이메일 발송
  → JWT 토큰 반환

[인증코드 입력] POST /auth/verify-email
  → 코드 검증 → is_email_verified=True

[재발송] POST /auth/resend-verification
  → 60초 쿨다운 체크
  → 이전 코드 무효화 + 새 코드 생성·발송
```

## API 엔드포인트

| 엔드포인트 | 메서드 | 인증 | 설명 |
|-----------|--------|------|------|
| `/auth/register` | POST | - | 기존 + 인증코드 발송 추가 |
| `/auth/verify-email` | POST | JWT | `{ code: "482917" }` → 인증 처리 |
| `/auth/resend-verification` | POST | JWT | 재발송 (60초 쿨다운) |
| `/auth/me` | GET | JWT | 기존 + `is_email_verified` 필드 추가 |

### 에러 케이스

| 상황 | HTTP | 메시지 |
|------|------|--------|
| 코드 불일치 | 400 | 인증코드가 올바르지 않습니다 |
| 코드 만료 | 400 | 인증코드가 만료되었습니다. 재발송해주세요 |
| 시도 5회 초과 | 400 | 시도 횟수를 초과했습니다. 재발송해주세요 |
| 재발송 쿨다운 | 429 | 60초 후 다시 시도해주세요 |
| 이미 인증 완료 | 400 | 이미 인증된 이메일입니다 |

## 이메일 서비스 추상화

```python
# backend/app/services/email/base.py
class EmailService(ABC):
    @abstractmethod
    async def send(self, to: str, subject: str, body_html: str) -> None: ...

# backend/app/services/email/gmail_smtp.py
class GmailSmtpEmailService(EmailService):
    # aiosmtplib으로 비동기 발송

# backend/app/services/email/__init__.py
def get_email_service() -> EmailService:
    # 환경변수 기반 팩토리
```

### 환경변수

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=benefit.butler.app@gmail.com
SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx    # Gmail 앱 비밀번호
SMTP_FROM=benefit.butler.app@gmail.com
```

### 의존성

```
aiosmtplib    # 비동기 SMTP 클라이언트
```

## 프론트엔드

### VerifyEmailScreen (신규)

- 6자리 숫자 입력 (TextInput, `keyboardType="number-pad"`)
- 재발송 버튼 + 쿨다운 카운트다운 (60초)
- 로그아웃 링크

### 네비게이션 분기 변경

```
RootNavigation
├── AuthNavigator              ← 비로그인
├── VerifyEmailScreen          ← 로그인 + 미인증 (NEW)
└── MainNavigator              ← 로그인 + 인증 완료
```

```typescript
if (!user)                         → AuthNavigator
else if (!user.is_email_verified)  → VerifyEmailScreen
else                               → MainNavigator
```

### authStore 변경

- `verifyEmail(code)`: 신규 메서드
- `resendVerification()`: 신규 메서드
- `register()`: 기존 로직 유지 (가입 후 자동 로그인, 미인증이므로 VerifyEmailScreen으로 이동)

### User 타입 변경

```typescript
interface User {
  // ... 기존 필드
  is_email_verified: boolean;
}
```
