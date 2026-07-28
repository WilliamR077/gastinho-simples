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

// O emissor OAuth precisa ser o host direto do Supabase — nunca o proxy do
// Lovable Cloud. Construímos a partir do project ref, que o Vite substitui
// como literal em build time (mantendo o módulo import-safe).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "gastinho-simples-mcp",
  title: "Gastinho Simples",
  version: "0.1.0",
  instructions:
    "Ferramentas do Gastinho Simples. Confirme a conta com get_connection_identity. Em pedidos sobre gastos recentes, últimos ou realizados, use time_scope=occurred; para próximas parcelas use future; use all somente quando o usuário pedir todos os registros. Use search_transactions para buscas unificadas, get_spending_breakdown para valores por categoria, cartão ou forma de pagamento e compare_periods para comparações factuais. Use list_cards para localizar o cartão, get_card_installments para parcelas individuais registradas e get_card_summary para o total registrado no período calculado. Recorrências não fazem parte dessas respostas e cartões inativos podem aparecer no histórico. Nunca chame o resumo de saldo bancário, limite real disponível ou fatura oficialmente paga/em aberto. Use list_categories para UUIDs. Não invente dados quando uma busca não retornar resultados.",
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
  ],
});
