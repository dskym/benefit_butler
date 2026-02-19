# Benefit Butler Skeleton Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Monorepo 구조의 FastAPI + React Native(Expo) 풀스택 스켈레톤 코드를 생성한다. Core 기능(Auth + Basic Ledger)의 디렉터리 구조, 모델, 라우터, 서비스 시그니처를 완성하여 서버 기동 및 앱 실행이 가능한 상태로 만든다.

**Architecture:** Domain-Driven Modular. 백엔드는 api/models/schemas/services/core 레이어로 분리하고, 프론트엔드는 screens/components/services/store/navigation으로 분리한다. 각 파일은 실제 구현 대신 `# TODO: implement` 주석과 함께 시그니처만 정의한다.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2.x, Alembic, PostgreSQL, pydantic-settings, python-jose, passlib, React Native (Expo SDK 51), TypeScript, Zustand, axios, React Navigation 6

---

## Task 1: 인프라 — docker-compose + 환경변수

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/.env.example`

**Step 1: docker-compose.yml 작성**

```yaml
# docker-compose.yml
version: "3.9"

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: benefit
      POSTGRES_PASSWORD: benefit
      POSTGRES_DB: benefit_butler
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**Step 2: .env.example 작성**

```
# backend/.env.example
DATABASE_URL=postgresql://benefit:benefit@localhost:5432/benefit_butler
SECRET_KEY=your-secret-key-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

**Step 3: PostgreSQL 컨테이너 기동 확인**

```bash
docker compose up -d db
docker compose ps
```
Expected: db 컨테이너가 `running` 상태

**Step 4: 커밋**

```bash
git add docker-compose.yml backend/.env.example
git commit -m "feat: add docker-compose and env example"
```

---

## Task 2: 백엔드 — 프로젝트 초기화 및 의존성

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/app/__init__.py`

**Step 1: requirements.txt 작성**

```
# backend/requirements.txt
fastapi==0.111.0
uvicorn[standard]==0.30.1
sqlalchemy==2.0.30
alembic==1.13.1
psycopg2-binary==2.9.9
pydantic-settings==2.3.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
```

**Step 2: 패키지 설치**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Expected: Successfully installed 메시지

**Step 3: `backend/app/__init__.py` 생성 (빈 파일)**

```python
# backend/app/__init__.py
```

**Step 4: 커밋**

```bash
git add backend/requirements.txt backend/app/__init__.py
git commit -m "feat: add backend dependencies"
```

---

## Task 3: 백엔드 — core 레이어 (config, database, security)

**Files:**
- Create: `backend/app/core/config.py`
- Create: `backend/app/core/database.py`
- Create: `backend/app/core/security.py`
- Create: `backend/app/core/__init__.py`

**Step 1: `backend/app/core/config.py`**

```python
# backend/app/core/config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    class Config:
        env_file = ".env"


settings = Settings()
```

**Step 2: `backend/app/core/database.py`**

```python
# backend/app/core/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Step 3: `backend/app/core/security.py`**

```python
# backend/app/core/security.py
from datetime import datetime, timedelta

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> str:
    """Returns subject (user id) or raises JWTError."""
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    return payload["sub"]
```

**Step 4: `backend/app/core/__init__.py` 생성 (빈 파일)**

```python
# backend/app/core/__init__.py
```

**Step 5: 커밋**

```bash
git add backend/app/core/
git commit -m "feat: add backend core layer (config, database, security)"
```

---

## Task 4: 백엔드 — SQLAlchemy 모델

**Files:**
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/user.py`
- Create: `backend/app/models/category.py`
- Create: `backend/app/models/transaction.py`

**Step 1: `backend/app/models/user.py`**

```python
# backend/app/models/user.py
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
```

**Step 2: `backend/app/models/category.py`**

```python
# backend/app/models/category.py
import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TransactionType(str, Enum):
    income = "income"
    expense = "expense"
    transfer = "transfer"


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # income/expense/transfer
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)  # hex color
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
```

**Step 3: `backend/app/models/transaction.py`**

```python
# backend/app/models/transaction.py
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    transacted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
```

**Step 4: `backend/app/models/__init__.py`**

```python
# backend/app/models/__init__.py
from app.models.user import User
from app.models.category import Category
from app.models.transaction import Transaction

__all__ = ["User", "Category", "Transaction"]
```

**Step 5: 커밋**

```bash
git add backend/app/models/
git commit -m "feat: add SQLAlchemy models (User, Category, Transaction)"
```

---

## Task 5: 백엔드 — Pydantic 스키마

**Files:**
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/schemas/user.py`
- Create: `backend/app/schemas/category.py`
- Create: `backend/app/schemas/transaction.py`

**Step 1: `backend/app/schemas/user.py`**

```python
# backend/app/schemas/user.py
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
```

**Step 2: `backend/app/schemas/category.py`**

```python
# backend/app/schemas/category.py
import uuid
from datetime import datetime

from pydantic import BaseModel


class CategoryCreate(BaseModel):
    name: str
    type: str  # income/expense/transfer
    color: str | None = None


class CategoryUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    color: str | None = None


class CategoryResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    type: str
    color: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
```

**Step 3: `backend/app/schemas/transaction.py`**

```python
# backend/app/schemas/transaction.py
import uuid
from datetime import datetime

from pydantic import BaseModel


class TransactionCreate(BaseModel):
    type: str  # income/expense/transfer
    amount: float
    description: str | None = None
    category_id: uuid.UUID | None = None
    transacted_at: datetime


class TransactionUpdate(BaseModel):
    type: str | None = None
    amount: float | None = None
    description: str | None = None
    category_id: uuid.UUID | None = None
    transacted_at: datetime | None = None


class TransactionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    category_id: uuid.UUID | None
    type: str
    amount: float
    description: str | None
    transacted_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

**Step 4: `backend/app/schemas/__init__.py`**

```python
# backend/app/schemas/__init__.py
```

**Step 5: 커밋**

```bash
git add backend/app/schemas/
git commit -m "feat: add Pydantic schemas (User, Category, Transaction)"
```

---

## Task 6: 백엔드 — 서비스 레이어 (시그니처)

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/auth.py`
- Create: `backend/app/services/category.py`
- Create: `backend/app/services/transaction.py`

**Step 1: `backend/app/services/auth.py`**

```python
# backend/app/services/auth.py
import uuid

from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User
from app.schemas.user import UserCreate


def register_user(db: Session, data: UserCreate) -> User:
    # TODO: check duplicate email
    # TODO: create User with hashed password
    # TODO: db.add / db.commit / db.refresh
    raise NotImplementedError


def authenticate_user(db: Session, email: str, password: str) -> str:
    """Returns JWT access token or raises HTTPException 401."""
    # TODO: fetch user by email
    # TODO: verify_password
    # TODO: create_access_token
    raise NotImplementedError


def get_user_by_id(db: Session, user_id: uuid.UUID) -> User:
    # TODO: return db.get(User, user_id) or raise 404
    raise NotImplementedError
```

**Step 2: `backend/app/services/category.py`**

```python
# backend/app/services/category.py
import uuid

from sqlalchemy.orm import Session

from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate


def list_categories(db: Session, user_id: uuid.UUID) -> list[Category]:
    # TODO: filter by user_id
    raise NotImplementedError


def create_category(db: Session, user_id: uuid.UUID, data: CategoryCreate) -> Category:
    # TODO: create and persist Category
    raise NotImplementedError


def get_category(db: Session, user_id: uuid.UUID, category_id: uuid.UUID) -> Category:
    # TODO: fetch, verify ownership, or raise 404
    raise NotImplementedError


def update_category(db: Session, user_id: uuid.UUID, category_id: uuid.UUID, data: CategoryUpdate) -> Category:
    # TODO: fetch, patch fields, commit
    raise NotImplementedError


def delete_category(db: Session, user_id: uuid.UUID, category_id: uuid.UUID) -> None:
    # TODO: fetch, verify ownership, delete
    raise NotImplementedError
```

**Step 3: `backend/app/services/transaction.py`**

```python
# backend/app/services/transaction.py
import uuid

from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate, TransactionUpdate


def list_transactions(db: Session, user_id: uuid.UUID) -> list[Transaction]:
    # TODO: filter by user_id, order by transacted_at desc
    raise NotImplementedError


def create_transaction(db: Session, user_id: uuid.UUID, data: TransactionCreate) -> Transaction:
    # TODO: create and persist Transaction
    raise NotImplementedError


def get_transaction(db: Session, user_id: uuid.UUID, tx_id: uuid.UUID) -> Transaction:
    # TODO: fetch, verify ownership, or raise 404
    raise NotImplementedError


def update_transaction(db: Session, user_id: uuid.UUID, tx_id: uuid.UUID, data: TransactionUpdate) -> Transaction:
    # TODO: fetch, patch fields, commit
    raise NotImplementedError


def delete_transaction(db: Session, user_id: uuid.UUID, tx_id: uuid.UUID) -> None:
    # TODO: fetch, verify ownership, delete
    raise NotImplementedError
```

**Step 4: `backend/app/services/__init__.py`**

```python
# backend/app/services/__init__.py
```

**Step 5: 커밋**

```bash
git add backend/app/services/
git commit -m "feat: add service layer signatures (auth, category, transaction)"
```

---

## Task 7: 백엔드 — API 라우터

**Files:**
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/v1/__init__.py`
- Create: `backend/app/api/v1/endpoints/__init__.py`
- Create: `backend/app/api/v1/endpoints/auth.py`
- Create: `backend/app/api/v1/endpoints/categories.py`
- Create: `backend/app/api/v1/endpoints/transactions.py`
- Create: `backend/app/api/v1/router.py`

**Step 1: `backend/app/api/v1/endpoints/auth.py`**

```python
# backend/app/api/v1/endpoints/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse
import app.services.auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def get_current_user(token: str = Depends(...), db: Session = Depends(get_db)):
    # TODO: extract Bearer token from Authorization header
    # TODO: decode_token → user_id
    # TODO: auth_service.get_user_by_id
    raise NotImplementedError


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, db: Session = Depends(get_db)):
    # TODO: auth_service.register_user
    raise NotImplementedError


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    # TODO: auth_service.authenticate_user
    raise NotImplementedError


@router.get("/me", response_model=UserResponse)
def me(current_user=Depends(get_current_user)):
    return current_user
```

**Step 2: `backend/app/api/v1/endpoints/categories.py`**

```python
# backend/app/api/v1/endpoints/categories.py
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.v1.endpoints.auth import get_current_user
from app.core.database import get_db
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
import app.services.category as category_service

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/", response_model=list[CategoryResponse])
def list_categories(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # TODO: category_service.list_categories(db, current_user.id)
    raise NotImplementedError


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(data: CategoryCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # TODO: category_service.create_category(db, current_user.id, data)
    raise NotImplementedError


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(category_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # TODO: category_service.get_category(db, current_user.id, category_id)
    raise NotImplementedError


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(category_id: uuid.UUID, data: CategoryUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # TODO: category_service.update_category(db, current_user.id, category_id, data)
    raise NotImplementedError


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # TODO: category_service.delete_category(db, current_user.id, category_id)
    raise NotImplementedError
```

**Step 3: `backend/app/api/v1/endpoints/transactions.py`**

```python
# backend/app/api/v1/endpoints/transactions.py
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.v1.endpoints.auth import get_current_user
from app.core.database import get_db
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionResponse
import app.services.transaction as transaction_service

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("/", response_model=list[TransactionResponse])
def list_transactions(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # TODO: transaction_service.list_transactions(db, current_user.id)
    raise NotImplementedError


@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(data: TransactionCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # TODO: transaction_service.create_transaction(db, current_user.id, data)
    raise NotImplementedError


@router.get("/{tx_id}", response_model=TransactionResponse)
def get_transaction(tx_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # TODO: transaction_service.get_transaction(db, current_user.id, tx_id)
    raise NotImplementedError


@router.put("/{tx_id}", response_model=TransactionResponse)
def update_transaction(tx_id: uuid.UUID, data: TransactionUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # TODO: transaction_service.update_transaction(db, current_user.id, tx_id, data)
    raise NotImplementedError


@router.delete("/{tx_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(tx_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # TODO: transaction_service.delete_transaction(db, current_user.id, tx_id)
    raise NotImplementedError
```

**Step 4: `backend/app/api/v1/router.py`**

```python
# backend/app/api/v1/router.py
from fastapi import APIRouter

from app.api.v1.endpoints import auth, categories, transactions

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(categories.router)
api_router.include_router(transactions.router)
```

**Step 5: 빈 `__init__.py` 파일 생성**

```bash
touch backend/app/api/__init__.py
touch backend/app/api/v1/__init__.py
touch backend/app/api/v1/endpoints/__init__.py
```

**Step 6: 커밋**

```bash
git add backend/app/api/
git commit -m "feat: add API routers (auth, categories, transactions)"
```

---

## Task 8: 백엔드 — main.py 및 Alembic 초기화

**Files:**
- Create: `backend/app/main.py`
- Run: `alembic init` in backend/

**Step 1: `backend/app/main.py`**

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router

app = FastAPI(
    title="Benefit Butler API",
    version="0.1.0",
    description="금융 생활 자동화 및 카드 혜택 최적화 서비스",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}
```

**Step 2: Alembic 초기화**

```bash
cd backend
alembic init alembic
```

**Step 3: `backend/alembic/env.py` 수정** — `target_metadata` 설정

`alembic/env.py` 파일에서 아래 두 줄을 찾아 교체:
```python
# 기존
target_metadata = None

# 변경
from app.core.database import Base
from app.models import User, Category, Transaction  # noqa: F401
target_metadata = Base.metadata
```

그리고 `alembic/env.py` 상단에:
```python
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
```

**Step 4: 서버 기동 확인**

```bash
cd backend
cp .env.example .env
# .env에 실제 값 입력 후
uvicorn app.main:app --reload
```

Expected: `http://127.0.0.1:8000/health` 에서 `{"status": "ok"}` 응답
Expected: `http://127.0.0.1:8000/docs` 에서 Swagger UI 접근 가능

**Step 5: 커밋**

```bash
git add backend/app/main.py backend/alembic/ backend/alembic.ini
git commit -m "feat: add FastAPI main app and Alembic init"
```

---

## Task 9: 프론트엔드 — Expo 프로젝트 초기화

**Files:**
- Create: `frontend/` (Expo 프로젝트)

**Step 1: Expo 프로젝트 생성**

```bash
cd /Users/seungyoon-kim/Desktop/benefit_butler
npx create-expo-app frontend --template blank-typescript
```

**Step 2: 의존성 설치**

```bash
cd frontend
npx expo install expo-secure-store
npx expo install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context
npm install zustand axios
```

**Step 3: 기본 실행 확인**

```bash
npx expo start
```

Expected: Metro bundler가 실행되고 QR 코드 표시

**Step 4: 커밋**

```bash
git add frontend/
git commit -m "feat: initialize Expo TypeScript project with dependencies"
```

---

## Task 10: 프론트엔드 — 디렉터리 구조 및 타입 정의

**Files:**
- Create: `frontend/src/types/index.ts`
- Create: `frontend/src/services/api.ts`
- Create 디렉터리: `screens/auth`, `screens/dashboard`, `screens/transactions`, `screens/categories`, `components`, `store`, `navigation`

**Step 1: `frontend/src/types/index.ts`**

```typescript
// frontend/src/types/index.ts

export interface User {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: "income" | "expense" | "transfer";
  color: string | null;
  created_at: string;
}

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
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
```

**Step 2: `frontend/src/services/api.ts`**

```typescript
// frontend/src/services/api.ts
import axios from "axios";
import * as SecureStore from "expo-secure-store";

const BASE_URL = "http://localhost:8000/api/v1";
const TOKEN_KEY = "access_token";

export const apiClient = axios.create({ baseURL: BASE_URL });

// Request interceptor: JWT 자동 첨부
apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: 401 처리
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      // TODO: navigate to login screen
    }
    return Promise.reject(error);
  }
);

export const saveToken = (token: string) =>
  SecureStore.setItemAsync(TOKEN_KEY, token);
export const clearToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);
```

**Step 3: 디렉터리 생성 및 빈 index 파일**

```bash
mkdir -p frontend/src/screens/auth
mkdir -p frontend/src/screens/dashboard
mkdir -p frontend/src/screens/transactions
mkdir -p frontend/src/screens/categories
mkdir -p frontend/src/components
mkdir -p frontend/src/store
mkdir -p frontend/src/navigation
touch frontend/src/screens/auth/.gitkeep
touch frontend/src/screens/dashboard/.gitkeep
touch frontend/src/screens/transactions/.gitkeep
touch frontend/src/screens/categories/.gitkeep
touch frontend/src/components/.gitkeep
```

**Step 4: 커밋**

```bash
git add frontend/src/
git commit -m "feat: add frontend types, api client, and directory structure"
```

---

## Task 11: 프론트엔드 — Zustand 스토어

**Files:**
- Create: `frontend/src/store/authStore.ts`
- Create: `frontend/src/store/transactionStore.ts`
- Create: `frontend/src/store/categoryStore.ts`

**Step 1: `frontend/src/store/authStore.ts`**

```typescript
// frontend/src/store/authStore.ts
import { create } from "zustand";
import { User } from "../types";
import { apiClient, saveToken, clearToken } from "../services/api";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,

  login: async (email, password) => {
    // TODO: POST /auth/login → saveToken → fetchMe
    throw new Error("Not implemented");
  },

  register: async (email, password, name) => {
    // TODO: POST /auth/register
    throw new Error("Not implemented");
  },

  logout: async () => {
    // TODO: clearToken → set({ user: null })
    throw new Error("Not implemented");
  },

  fetchMe: async () => {
    // TODO: GET /auth/me → set({ user })
    throw new Error("Not implemented");
  },
}));
```

**Step 2: `frontend/src/store/transactionStore.ts`**

```typescript
// frontend/src/store/transactionStore.ts
import { create } from "zustand";
import { Transaction } from "../types";
import { apiClient } from "../services/api";

interface TransactionState {
  transactions: Transaction[];
  isLoading: boolean;
  fetchTransactions: () => Promise<void>;
  createTransaction: (data: Partial<Transaction>) => Promise<void>;
  updateTransaction: (id: string, data: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  isLoading: false,

  fetchTransactions: async () => {
    // TODO: GET /transactions/
    throw new Error("Not implemented");
  },

  createTransaction: async (data) => {
    // TODO: POST /transactions/
    throw new Error("Not implemented");
  },

  updateTransaction: async (id, data) => {
    // TODO: PUT /transactions/:id
    throw new Error("Not implemented");
  },

  deleteTransaction: async (id) => {
    // TODO: DELETE /transactions/:id
    throw new Error("Not implemented");
  },
}));
```

**Step 3: `frontend/src/store/categoryStore.ts`**

```typescript
// frontend/src/store/categoryStore.ts
import { create } from "zustand";
import { Category } from "../types";
import { apiClient } from "../services/api";

interface CategoryState {
  categories: Category[];
  isLoading: boolean;
  fetchCategories: () => Promise<void>;
  createCategory: (data: Partial<Category>) => Promise<void>;
  updateCategory: (id: string, data: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

export const useCategoryStore = create<CategoryState>((set) => ({
  categories: [],
  isLoading: false,

  fetchCategories: async () => {
    // TODO: GET /categories/
    throw new Error("Not implemented");
  },

  createCategory: async (data) => {
    // TODO: POST /categories/
    throw new Error("Not implemented");
  },

  updateCategory: async (id, data) => {
    // TODO: PUT /categories/:id
    throw new Error("Not implemented");
  },

  deleteCategory: async (id) => {
    // TODO: DELETE /categories/:id
    throw new Error("Not implemented");
  },
}));
```

**Step 4: 커밋**

```bash
git add frontend/src/store/
git commit -m "feat: add Zustand stores (auth, transaction, category)"
```

---

## Task 12: 프론트엔드 — 스크린 및 네비게이션 스켈레톤

**Files:**
- Create: `frontend/src/screens/auth/LoginScreen.tsx`
- Create: `frontend/src/screens/auth/RegisterScreen.tsx`
- Create: `frontend/src/screens/dashboard/DashboardScreen.tsx`
- Create: `frontend/src/screens/transactions/TransactionListScreen.tsx`
- Create: `frontend/src/screens/categories/CategoryListScreen.tsx`
- Create: `frontend/src/navigation/index.tsx`
- Modify: `frontend/App.tsx`

**Step 1: `frontend/src/screens/auth/LoginScreen.tsx`**

```typescript
// frontend/src/screens/auth/LoginScreen.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function LoginScreen() {
  // TODO: implement login form
  // TODO: useAuthStore().login(email, password)
  return (
    <View style={styles.container}>
      <Text>Login Screen — TODO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
});
```

**Step 2: `frontend/src/screens/auth/RegisterScreen.tsx`**

```typescript
// frontend/src/screens/auth/RegisterScreen.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function RegisterScreen() {
  // TODO: implement register form
  // TODO: useAuthStore().register(email, password, name)
  return (
    <View style={styles.container}>
      <Text>Register Screen — TODO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
});
```

**Step 3: 나머지 스크린 (동일 패턴)**

`DashboardScreen.tsx`, `TransactionListScreen.tsx`, `CategoryListScreen.tsx` 모두 동일한 placeholder 패턴으로 생성.

**Step 4: `frontend/src/navigation/index.tsx`**

```typescript
// frontend/src/navigation/index.tsx
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import LoginScreen from "../screens/auth/LoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";
import DashboardScreen from "../screens/dashboard/DashboardScreen";
import TransactionListScreen from "../screens/transactions/TransactionListScreen";
import CategoryListScreen from "../screens/categories/CategoryListScreen";

const AuthStack = createNativeStackNavigator();
const MainTab = createBottomTabNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainTab.Navigator>
      <MainTab.Screen name="Dashboard" component={DashboardScreen} />
      <MainTab.Screen name="Transactions" component={TransactionListScreen} />
      <MainTab.Screen name="Categories" component={CategoryListScreen} />
    </MainTab.Navigator>
  );
}

export default function RootNavigation() {
  const isAuthenticated = false; // TODO: useAuthStore().user !== null

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
```

**Step 5: `frontend/App.tsx` 수정**

```typescript
// frontend/App.tsx
import RootNavigation from "./src/navigation";

export default function App() {
  return <RootNavigation />;
}
```

**Step 6: 커밋**

```bash
git add frontend/src/screens/ frontend/src/navigation/ frontend/App.tsx
git commit -m "feat: add screen skeletons and navigation structure"
```

---

## 완료 체크리스트

- [ ] `docker compose up -d db` → PostgreSQL 정상 기동
- [ ] `uvicorn app.main:app --reload` → `/health` 응답 및 `/docs` 접근 가능
- [ ] `npx expo start` → Metro bundler 정상 기동
- [ ] 모든 도메인 디렉터리 존재 (auth, categories, transactions)
- [ ] 각 파일에 `# TODO: implement` 시그니처 정의 완료
- [ ] 13개 커밋으로 단계별 히스토리 기록
