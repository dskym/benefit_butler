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
  catalog_id: string | null;   // 연결된 카탈로그 카드 (혜택 자동 복사 출처)
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

export type BenefitTargetType = "all" | "category" | "merchant";

export interface CatalogBenefit {
  id: string;
  title: string | null;
  target_type: BenefitTargetType;
  category: string | null;        // target_type="category"일 때만
  merchant_names: string[];       // target_type="merchant"일 때만
  benefit_type: "cashback" | "points" | "discount" | "free";
  rate: number | null;
  flat_amount: number | null;
  monthly_cap: number | null;
  min_amount: number | null;
  requires_performance: boolean;
}

export interface CardCatalog {
  id: string;
  name: string;
  issuer: string;
  card_type: "credit_card" | "debit_card";
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  benefits: CatalogBenefit[];
}

export interface UserCardBenefit {
  id: string;
  user_card_id: string;
  title: string | null;
  target_type: BenefitTargetType;
  category: string | null;
  merchant_names: string[];
  benefit_type: "cashback" | "points" | "discount" | "free";
  rate: number | null;
  flat_amount: number | null;
  monthly_cap: number | null;
  min_amount: number | null;
  requires_performance: boolean;
  created_at: string;
}

export interface ResolvedMerchant {
  merchant_id: string | null;
  merchant_name: string | null;
  category: string | null;
  source: "alias" | "partial" | "naver" | "none";
  confidence: number;
}

export interface MerchantLookupResponse extends ResolvedMerchant {
  available_categories: string[];
}

export interface RecommendItem {
  card_id: string;
  card_name: string;
  benefit_title: string | null;
  benefit_type: "cashback" | "points" | "discount" | "free";
  benefit_description: string;
  matched_by: BenefitTargetType;
  effective_value: number;
  performance_required: boolean;
  performance_met: boolean | null;  // null = 실적 목표 미설정
  is_near_target: boolean;
}

export interface RecommendResponse {
  resolved: ResolvedMerchant | null;
  results: RecommendItem[];
}
