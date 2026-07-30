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
import getInstallmentSeries from "./tools/get-installment-series";
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
import deleteExpense from "./tools/delete-expense";
import deleteIncome from "./tools/delete-income";
import createRecurringExpense from "./tools/create-recurring-expense";
import createRecurringIncome from "./tools/create-recurring-income";
import updateRecurringExpense from "./tools/update-recurring-expense";
import updateRecurringIncome from "./tools/update-recurring-income";
import deleteRecurringExpense from "./tools/delete-recurring-expense";
import deleteRecurringIncome from "./tools/delete-recurring-income";
import createGoal from "./tools/create-goal";
import updateGoal from "./tools/update-goal";
import deleteGoal from "./tools/delete-goal";
import createCard from "./tools/create-card";
import updateCard from "./tools/update-card";
import deleteCard from "./tools/delete-card";
import createExpenseCategory from "./tools/create-expense-category";
import updateExpenseCategory from "./tools/update-expense-category";
import createIncomeCategory from "./tools/create-income-category";
import updateIncomeCategory from "./tools/update-income-category";
import deleteExpenseCategory from "./tools/delete-expense-category";
import deleteIncomeCategory from "./tools/delete-income-category";
import listSharedGroups from "./tools/list-shared-groups";
import listSharedGroupMembers from "./tools/list-shared-group-members";
import getExpenseSplitDetails from "./tools/get-expense-split-details";
import getGroupMemberSummary from "./tools/get-group-member-summary";
import getGroupSettlement from "./tools/get-group-settlement";
import updateSharedGroup from "./tools/update-shared-group";

// O emissor OAuth precisa ser o host direto do Supabase — nunca o proxy do
// Lovable Cloud. Construímos a partir do project ref, que o Vite substitui
// como literal em build time (mantendo o módulo import-safe).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "gastinho-simples-mcp",
  title: "Gastinho Simples",
  version: "0.1.0",
  instructions:
    "Use get_installment_series para ler a série completa de uma despesa ou receita parcelada, incluindo IDs, datas e updated_at individuais; a tool é somente leitura e não reconstrói parcelas ausentes. " +
    "Ferramentas do Gastinho Simples. Confirme a conta com get_connection_identity. Use list_shared_groups para descobrir grupos, group_id, papel atual, membership_id e updated_at; use list_shared_group_members para identidades públicas reduzidas dos membros. update_shared_group edita somente nome, descrição e cor de grupo ativo e consistente para owner/admin, sempre reutilizando exatamente o updated_at de list_shared_groups. Use get_expense_split_details para um rateio persistido específico, get_group_member_summary para agregados do período e get_group_settlement somente para sugestões matemáticas: nenhuma delas executa transferência, confirma pagamento ou altera dados. Nunca invente group_id, exponha e-mail/UUID de usuário nem trate grupos como contas bancárias. Antes de update_expense, update_income, delete_expense ou delete_income, localize o lançamento com search_transactions, list_expenses ou list_incomes e reutilize exatamente o updated_at retornado como expected_updated_at. Exclusões são definitivas, sempre exigem confirm_delete=true e, para parcelas, confirmação específica; elas removem somente a linha selecionada, nunca a série inteira. Nunca tente editar ou excluir recurso de outro proprietário nem afirmar que uma série inteira foi alterada. Em pedidos sobre gastos recentes, últimos ou realizados, use time_scope=occurred; para próximas parcelas use future; use all somente quando o usuário pedir todos os registros. Use search_transactions para lançamentos reais, get_spending_breakdown para valores por categoria, cartão ou forma de pagamento e compare_periods para comparações factuais. get_cashflow_series representa somente realizado. get_cashflow_projection separa realizado, futuro materializado e templates recorrentes; futuro materializado são linhas reais com data futura, recorrências são apenas templates, e a soma combinada pode conter sobreposição. Ela não representa saldo bancário nem previsão garantida. Para templates isolados use get_recurring_forecast; para parcelas futuras já materializadas use get_card_installments. Use list_cards para localizar o cartão e obter updated_at antes de update_card ou delete_card; delete_card exige confirmação, cartão inativo e ausência total de despesas, parcelas ou templates vinculados. Use get_card_summary para o total registrado no período calculado. Recorrências são templates mensais: use list_recurring_transactions para listá-las e get_recurring_forecast apenas para projeções baseadas nesses templates. Metas também são mensais: use list_goals para localizar uma meta e obter updated_at antes de update_goal ou delete_goal; delete_goal exige confirm_delete=true. create_goal, update_goal e delete_goal não criam nem alteram transações e não representam investimento ou poupança acumulada. Use get_goal_progress para o progresso calculado. Mantenha realizado e recorrente separados, informe o risco de sobreposição da projeção quando houver templates participantes e não gere recomendação financeira. Use get_category_usage somente para fatos históricos sobre categorias pessoais: categorias compartilhadas não existem no modelo atual e transações compartilhadas de outros proprietários não entram. O forecast não representa transações efetivamente lançadas e nunca deve ser somado automaticamente a parcelas ou lançamentos futuros. Nunca chame resultados de saldo bancário, limite real disponível ou fatura oficialmente paga/em aberto. Use list_categories para obter UUID e updated_at; informe include_inactive=true ao localizar uma categoria inativa antes de update_expense_category ou update_income_category. Desativar ou renomear categoria não altera transações, recorrências, parcelas ou metas vinculadas. Não invente dados quando uma busca não retornar resultados.",
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
    getInstallmentSeries,
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
    deleteExpense,
    deleteIncome,
    createRecurringExpense,
    createRecurringIncome,
    updateRecurringExpense,
    updateRecurringIncome,
    deleteRecurringExpense,
    deleteRecurringIncome,
    createGoal,
    updateGoal,
    deleteGoal,
    createCard,
    updateCard,
    deleteCard,
    createExpenseCategory,
    updateExpenseCategory,
    createIncomeCategory,
    updateIncomeCategory,
    deleteExpenseCategory,
    deleteIncomeCategory,
    listSharedGroups,
    listSharedGroupMembers,
    getExpenseSplitDetails,
    getGroupMemberSummary,
    getGroupSettlement,
    updateSharedGroup,
  ],
});
