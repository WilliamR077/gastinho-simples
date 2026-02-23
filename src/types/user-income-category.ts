export interface UserIncomeCategory {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string | null;
  is_default: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface UserIncomeCategoryInsert {
  name: string;
  icon: string;
  color?: string;
  is_default?: boolean;
  is_active?: boolean;
  display_order?: number;
}

export interface UserIncomeCategoryUpdate {
  name?: string;
  icon?: string;
  color?: string;
  is_active?: boolean;
  display_order?: number;
}
