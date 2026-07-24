import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listExpenses from "./tools/list-expenses";
import listIncomes from "./tools/list-incomes";
import createExpense from "./tools/create-expense";
import createIncome from "./tools/create-income";
import getSummary from "./tools/get-summary";
import listCategories from "./tools/list-categories";
import getConnectionIdentity from "./tools/get-connection-identity";

// O emissor OAuth precisa ser o host direto do Supabase — nunca o proxy do
// Lovable Cloud. Construímos a partir do project ref, que o Vite substitui
// como literal em build time (mantendo o módulo import-safe).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "gastinho-simples-mcp",
  title: "Gastinho Simples",
  version: "0.1.0",
  instructions:
    "Ferramentas do Gastinho Simples. Use get_connection_identity para confirmar qual conta está conectada, list_categories para descobrir UUIDs de categorias, list_expenses/list_incomes para consultar transações, create_expense/create_income para registrar, e get_summary para totais e saldo do período.",
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
  ],
});
