export type IncomeCategory = 
  | 'salario'
  | 'freelance'
  | 'investimentos'
  | 'vendas'
  | 'bonus'
  | 'presente'
  | 'reembolso'
  | 'aluguel'
  | 'outros';

export const incomeCategoryLabels: Record<IncomeCategory, string> = {
  salario: 'Salário',
  freelance: 'Freelance',
  investimentos: 'Investimentos',
  vendas: 'Vendas',
  bonus: 'Bônus',
  presente: 'Presente',
  reembolso: 'Reembolso',
  aluguel: 'Aluguel',
  outros: 'Outros'
};

export const incomeCategoryIcons: Record<IncomeCategory, string> = {
  salario: '💼',
  freelance: '💻',
  investimentos: '📈',
  vendas: '🛒',
  bonus: '🎁',
  presente: '🎀',
  reembolso: '💰',
  aluguel: '🏠',
  outros: '📦'
};

export interface Income {
  is_active: any;
  id: string;
  user_id: string;
  description: string;
  amount: number;
  category: IncomeCategory;
  income_date: string;
  shared_group_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringIncome {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  category: IncomeCategory;
  day_of_month: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  shared_group_id: string | null;
  created_at: string;
  updated_at: string;
}
