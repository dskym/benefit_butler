# Benefit Butler — Skeleton Design

**Date**: 2026-02-19
**Scope**: Full-stack skeleton (Core features: Auth + Basic Ledger)
**Structure**: Monorepo (Domain-Driven Modular)

---

## 1. Directory Structure

```
benefit_butler/
├── backend/
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── endpoints/
│   │   │   │   ├── auth.py
│   │   │   │   ├── transactions.py
│   │   │   │   └── categories.py
│   │   │   └── router.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   └── security.py
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── transaction.py
│   │   │   └── category.py
│   │   ├── schemas/
│   │   │   ├── user.py
│   │   │   ├── transaction.py
│   │   │   └── category.py
│   │   ├── services/
│   │   │   ├── auth.py
│   │   │   ├── transaction.py
│   │   │   └── category.py
│   │   └── main.py
│   ├── alembic/
│   ├── alembic.ini
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── screens/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── transactions/
│   │   │   └── categories/
│   │   ├── components/
│   │   ├── services/
│   │   ├── store/
│   │   ├── navigation/
│   │   └── types/
│   ├── App.tsx
│   ├── app.json
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## 2. Data Models

### users
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| email | VARCHAR unique | |
| hashed_password | VARCHAR | |
| name | VARCHAR | |
| is_active | BOOLEAN | default true |
| created_at / updated_at | TIMESTAMP | |

### categories
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| name | VARCHAR | |
| type | ENUM(income/expense/transfer) | |
| color | VARCHAR | optional hex |
| created_at | TIMESTAMP | |

### transactions
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| category_id | UUID FK → categories | nullable |
| type | ENUM(income/expense/transfer) | |
| amount | NUMERIC(15,2) | |
| description | TEXT | |
| transacted_at | TIMESTAMP | 실제 거래 일시 |
| created_at / updated_at | TIMESTAMP | |

---

## 3. API Endpoints (v1)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register` | - | 회원가입 |
| POST | `/api/v1/auth/login` | - | 로그인 (JWT 발급) |
| GET | `/api/v1/auth/me` | JWT | 내 정보 조회 |
| GET | `/api/v1/transactions/` | JWT | 거래 목록 |
| POST | `/api/v1/transactions/` | JWT | 거래 생성 |
| GET | `/api/v1/transactions/{id}` | JWT | 거래 상세 |
| PUT | `/api/v1/transactions/{id}` | JWT | 거래 수정 |
| DELETE | `/api/v1/transactions/{id}` | JWT | 거래 삭제 |
| GET | `/api/v1/categories/` | JWT | 카테고리 목록 |
| POST | `/api/v1/categories/` | JWT | 카테고리 생성 |
| GET | `/api/v1/categories/{id}` | JWT | 카테고리 상세 |
| PUT | `/api/v1/categories/{id}` | JWT | 카테고리 수정 |
| DELETE | `/api/v1/categories/{id}` | JWT | 카테고리 삭제 |

---

## 4. Key Patterns

### Backend
- SQLAlchemy ORM + Alembic migrations
- `pydantic-settings` for typed env config
- JWT (HS256) via `python-jose`
- `Depends(get_current_user)` for auth guard on all protected routes
- Service layer holds business logic; routers are thin

### Frontend
- React Native (Expo) with TypeScript
- Zustand for state management (authStore, transactionStore, categoryStore)
- axios instance with request/response interceptors (JWT attach + 401 auto-logout)
- React Navigation: AuthStack + MainTabs structure

### Infrastructure
- docker-compose.yml with PostgreSQL service
- `.env.example` with required env vars documented
