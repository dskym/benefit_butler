# Database Schema

## ER Diagram
```
users (1) ──── (N) categories
       ├─ (1) ──── (N) transactions
       ├─ (1) ──── (N) user_cards
       └─ (1) ──── (N) email_verifications

categories (1) ──── (N) transactions (SET NULL)

user_cards (1) ──── (N) transactions (SET NULL)
          ├─ (1) ──── (N) user_card_benefits (CASCADE)
          └─ (N) ──── (0,1) card_catalog (SET NULL)

card_catalog (1) ──── (N) catalog_benefits (CASCADE)
```

## Tables

### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, default=uuid4 |
| email | String(255) | UNIQUE, NOT NULL, INDEXED |
| hashed_password | String(255) | NOT NULL |
| name | String(100) | NOT NULL |
| is_active | Boolean | NOT NULL, default=True |
| is_email_verified | Boolean | NOT NULL, default=False |
| created_at | DateTime(tz) | NOT NULL, default=NOW() |
| updated_at | DateTime(tz) | NOT NULL, default=NOW(), onupdate=NOW() |

### categories
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, default=uuid4 |
| user_id | UUID | FK→users CASCADE, NOT NULL |
| name | String(100) | NOT NULL |
| type | String(20) | NOT NULL (income/expense/transfer) |
| color | String(7) | NULLABLE (hex code) |
| is_default | Boolean | NOT NULL, default=False |
| created_at | DateTime(tz) | NOT NULL, default=NOW() |

### transactions
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, default=uuid4 |
| user_id | UUID | FK→users CASCADE, NOT NULL |
| category_id | UUID | FK→categories SET NULL |
| type | String(20) | NOT NULL (income/expense/transfer) |
| amount | Numeric(15,2) | NOT NULL |
| description | Text | NULLABLE |
| payment_type | String(20) | NULLABLE |
| user_card_id | UUID | FK→user_cards SET NULL |
| is_favorite | Boolean | NOT NULL, default=False |
| transacted_at | DateTime(tz) | NOT NULL |
| created_at | DateTime(tz) | NOT NULL, default=NOW() |
| updated_at | DateTime(tz) | NOT NULL, default=NOW(), onupdate=NOW() |

### user_cards
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, default=uuid4 |
| user_id | UUID | FK→users CASCADE, NOT NULL |
| catalog_id | UUID | FK→card_catalog SET NULL |
| type | String(20) | NOT NULL (credit_card/debit_card) |
| name | String(100) | NOT NULL |
| monthly_target | Integer | NULLABLE (KRW) |
| billing_day | Integer | NULLABLE (1-28, NULL=달력 월) |
| created_at | DateTime(tz) | NOT NULL, default=NOW() |

### card_catalog
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, default=uuid4 |
| name | String(100) | NOT NULL |
| issuer | String(50) | NOT NULL |
| card_type | String(20) | NOT NULL (credit_card/debit_card) |
| image_url | String(500) | NULLABLE |
| is_active | Boolean | NOT NULL, default=True |
| created_at | DateTime(tz) | NOT NULL, default=NOW() |

### catalog_benefits
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, default=uuid4 |
| catalog_id | UUID | FK→card_catalog CASCADE, NOT NULL |
| category | String(50) | NOT NULL |
| benefit_type | String(20) | NOT NULL (cashback/points/discount/free) |
| rate | Float | NULLABLE (% 단위, 예: 3.0 = 3%) |
| flat_amount | Integer | NULLABLE (KRW) |
| monthly_cap | Integer | NULLABLE (KRW) |
| min_amount | Integer | NULLABLE (KRW) |
| created_at | DateTime(tz) | NOT NULL, default=NOW() |

### user_card_benefits
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, default=uuid4 |
| user_card_id | UUID | FK→user_cards CASCADE, NOT NULL |
| category | String(50) | NOT NULL |
| benefit_type | String(20) | NOT NULL (cashback/points/discount/free) |
| rate | Float | NULLABLE (%) |
| flat_amount | Integer | NULLABLE (KRW) |
| monthly_cap | Integer | NULLABLE (KRW) |
| min_amount | Integer | NULLABLE (KRW) |
| created_at | DateTime(tz) | NOT NULL, default=NOW() |

### email_verifications
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, default=uuid4 |
| user_id | UUID | FK→users CASCADE, NOT NULL |
| code | String(6) | NOT NULL |
| expires_at | DateTime(tz) | NOT NULL |
| attempts | Integer | NOT NULL, default=0 |
| is_used | Boolean | NOT NULL, default=False |
| created_at | DateTime(tz) | NOT NULL, default=NOW() |

## Migration History
| Revision | Description |
|----------|-------------|
| d9ac08efea96 | init: users, categories, transactions |
| 04fbc4c9398f | add is_default to categories |
| 91fc1a350c9d | add user_cards, payment_type, user_card_id |
| a3e7f2b1d5c8 | add monthly_target to user_cards |
| 8570786b7481 | add is_favorite to transactions |
| b2f3c4d5e6a7 | add billing_day to user_cards |
| c3d4e5f6a7b8 | add card_catalog, catalog_benefits, user_card_benefits |
| d4e5f6a7b8c9 | seed card_catalog |
| e5f6a7b8c9d0 | add email_verifications, is_email_verified |
