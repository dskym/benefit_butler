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
  is_default: boolean;
  created_at: string;
}

export interface UserCard {
  id: string;
  user_id: string;
  type: "credit_card" | "debit_card";
  name: string;
  monthly_target: number | null;
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
  payment_type: "cash" | "credit_card" | "debit_card" | "bank" | null;
  user_card_id: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
