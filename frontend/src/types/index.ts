// frontend/src/types/index.ts

export interface User {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  is_email_verified: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: "income" | "expense" | "transfer";
  color: string | null;
  is_default: boolean;
  created_at: string;
}

export interface UserCard {
  id: string;
  user_id: string;
  type: "credit_card" | "debit_card";
  name: string;
  monthly_target: number | null;
  billing_day: number | null;  // 1~28; null = calendar month
  created_at: string;
}

export interface CardPerformanceItem {
  card_id: string;
  card_name: string;
  card_type: "credit_card" | "debit_card";
  monthly_target: number | null;
  billing_day: number | null;
  period_start: string;  // ISO date "YYYY-MM-DD"
  period_end: string;    // ISO date "YYYY-MM-DD"
  current_spending: number;
  remaining: number | null;
  achievement_percent: number | null;
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
  payment_type: "cash" | "credit_card" | "debit_card" | "bank" | null;
  user_card_id: string | null;
  is_favorite?: boolean;
  _isPending?: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface PendingMutation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'TOGGLE_FAVORITE';
  resource: 'transaction';
  payload: unknown;
  localId?: string;   // CREATE 시 임시 UUID
  createdAt: number;
  retryCount: number;
}

export interface CardCatalog {
  id: string;
  name: string;
  issuer: string;
  card_type: "credit_card" | "debit_card";
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface UserCardBenefit {
  id: string;
  user_card_id: string;
  category: string;
  benefit_type: "cashback" | "points" | "discount" | "free";
  rate: number | null;
  flat_amount: number | null;
  monthly_cap: number | null;
  min_amount: number | null;
  created_at: string;
}

export interface RecommendResult {
  card_id: string;
  card_name: string;
  benefit_type: "cashback" | "points" | "discount" | "free";
  benefit_description: string;
  effective_value: number;
  is_near_target: boolean;
}
