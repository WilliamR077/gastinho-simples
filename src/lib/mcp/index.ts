import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listExpenses from "./tools/list-expenses";
import listIncomes from "./tools/list-incomes";
import createExpense from "./tools/create-expense";
import createIncome from "./tools/create-income";
import getSummary from "./tools/get-summary";
import listCategories from "./tools/list-categories";
import getConnectionIdentity from "./tools/get-connection-identity";
import searchTransactions from "./tools/search-transactions";
import getSpendingBreakdown from "./tools/get-spending-breakdown";
import comparePeriods from "./tools/compare-periods";
import listCards from "./tools/list-cards";
import getCardInstallments from "./tools/get-card-installments";
import getCardSummary from "./tools/get-card-summary";
import listRecurringTransactions from "./tools/list-recurring-transactions";
import getRecurringForecast from "./tools/get-recurring-forecast";
import listGoals from "./tools/list-goals";
import getGoalProgress from "./tools/get-goal-progress";
import getCategoryUsage from "./tools/get-category-usage";
import getCashflowSeries from "./tools/get-cashflow-series";
import getCashflowProjection from "./tools/get-cashflow-projection";
import updateExpense from "./tools/update-expense";
import updateIncome from "./tools/update-income";

// O emissor OAuth precisa ser o host direto do Supabase — nunca o proxy do
// Lovable Cloud. Construímos a partir do project ref, que o Vite substitui
// como literal em build time (mantendo o módulo import-safe).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "gastinho-simples-mcp",
  title: "Gastinho Simples",
  version: "0.1.0",
  instructions:
    "Ferramentas do Gastinho Simples. Confirme a conta com get_connection_identity. Antes de update_expense ou update_income, localize o lançamento com search_transactions, list_expenses ou list_incomes e reutilize exatamente o updated_at retornado como expected_updated_at. Nunca tente editar recurso de outro proprietário nem afirmar que uma série inteira foi alterada; update_expense altera uma única parcela e exige confirmação quando aplicável. Em pedidos sobre gastos recentes, últimos ou realizados, use time_scope=occurred; para próximas parcelas use future; use all somente quando o usuário pedir todos os registros. Use search_transactions para lançamentos reais, get_spending_breakdown para valores por categoria, cartão ou forma de pagamento e compare_periods para comparações factuais. get_cashflow_series representa somente realizado. get_cashflow_projection separa realizado, futuro materializado e templates recorrentes; futuro materializado são linhas reais com data futura, recorrências são apenas templates, e a soma combinada pode conter sobreposição. Ela não representa saldo bancário nem previsão garantida. Para templates isolados use get_recurring_forecast; para parcelas futuras já materializadas use get_card_installments. Use list_cards para localizar o cartão e get_card_summary para o total registrado no período calculado. Recorrências são templates mensais: use list_recurring_transactions para listá-las e get_recurring_forecast apenas para projeções baseadas nesses templates. Metas também são mensais: use list_goals e get_goal_progress; elas não são metas de poupança com contribuições. Mantenha realizado e recorrente separados, informe o risco de sobreposição da projeção quando houver templates participantes e não gere recomendação financeira. Use get_category_usage somente para fatos históricos sobre categorias pessoais: categorias compartilhadas não existem no modelo atual e transações compartilhadas de outros proprietários não entram. O forecast não representa transações efetivamente lançadas e nunca deve ser somado automaticamente a parcelas ou lançamentos futuros. Nunca chame resultados de saldo bancário, limite real disponível ou fatura oficialmente paga/em aberto. Use list_categories para UUIDs. Não invente dados quando uma busca não retornar resultados.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getConnectionIdentity,
    listExpenses,
    listIncomes,
    createExpense,
    createIncome,
    getSummary,
    listCategories,
    searchTransactions,
    getSpendingBreakdown,
    comparePeriods,
    listCards,
    getCardInstallments,
    getCardSummary,
    listRecurringTransactions,
    getRecurringForecast,
    listGoals,
    getGoalProgress,
    getCategoryUsage,
    getCashflowSeries,
    getCashflowProjection,
    updateExpense,
    updateIncome,
  ],
});
