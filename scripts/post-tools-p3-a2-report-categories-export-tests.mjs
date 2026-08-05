import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const root = process.cwd();
const read = (...parts) => readFileSync(join(root, ...parts), "utf8");
const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
const lines = (value) => value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);

async function importTypeScript(...parts) {
  const source = read(...parts);
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`);
}

const rules = await importTypeScript("src", "utils", "report-business-rules.ts");
const categoryRules = await importTypeScript("src", "utils", "report-category-resolver.ts");
const {
  buildRecurringProjections,
  calculatePercentageDelta,
  filterRowsByCivilPeriod,
  reportCivilDateKey,
  sumRealizedAmounts,
} = rules;
const { resolveReportCategory, resolveReportGoalCategory } = categoryRules;

const categories = [
  { id: "personal-caldas", name: "Caldas Novas", icon: "🏖️" },
  { id: "default-services", name: "Serviços", icon: "🔧" },
  { id: "default-food", name: "Alimentação", icon: "🍔" },
  { id: "default-education", name: "Educação", icon: "📚" },
  { id: "group-travel", name: "Viagem do grupo", icon: "✈️" },
];

// 1–6: precedência estrita e fontes permitidas para categorias.
assert.equal(resolveReportCategory({ categoryId: "personal-caldas", categoryName: "Outros" }, categories).name, "Caldas Novas");
assert.equal(resolveReportCategory({ categoryId: "missing", categoryName: "Alimentação" }, categories).name, "Categoria não resolvida");
assert.equal(resolveReportCategory({ categoryName: "Farmácia" }, categories).name, "Farmácia");
assert.equal(resolveReportCategory({}, categories).name, "Outros");
assert.equal(resolveReportCategory({ categoryId: "personal-caldas" }, categories).name, "Caldas Novas");
assert.equal(resolveReportCategory({ categoryId: "group-travel" }, categories).name, "Viagem do grupo");

const expense = (id, amount, date, categoryId, paymentMethod = "credit", categoryName = "Outros") => ({
  id,
  amount,
  expense_date: date,
  category_id: categoryId,
  category_name: categoryName,
  category_icon: "📦",
  payment_method: paymentMethod,
});

const februaryExpenses = [
  expense("caldas-1", 150, "2026-02-05T00:00:00Z", "personal-caldas", "pix"),
  expense("caldas-2", 129.9, "2026-02-20T00:00:00-03:00", "personal-caldas", "pix"),
  expense("service-1", 191.75, "2026-02-14T00:00:00Z", "default-services"),
  expense("service-2", 29.2, "2026-02-04T00:00:00Z", "default-services"),
  expense("food-1", 20.9, "2026-02-01T00:00:00Z", "default-food"),
  expense("food-2", 20, "2026-02-01T00:00:00-03:00", "default-food"),
  expense("food-3", 20, "2026-02-02T00:00:00Z", "default-food"),
  expense("food-4", 20, "2026-02-03T00:00:00Z", "default-food"),
  expense("food-5", 20, "2026-02-07T00:00:00Z", "default-food"),
  expense("food-6", 15, "2026-02-09T00:00:00Z", "default-food"),
  expense("food-7", 13.37, "2026-02-11T00:00:00Z", "default-food"),
  expense("food-8", 20, "2026-02-06T00:00:00Z", "default-food"),
  expense("food-9", 15.09, "2026-02-08T00:00:00Z", "default-food"),
  expense("food-10", 10, "2026-02-10T00:00:00Z", "default-food"),
  expense("food-11", 10, "2026-02-12T00:00:00Z", "default-food"),
  expense("education-1", 12.09, "2026-02-15T00:00:00Z", "default-education"),
  expense("education-2", 10, "2026-02-16T00:00:00Z", "default-education"),
  expense("education-3", 10, "2026-02-18T00:00:00Z", "default-education"),
];
const januaryExpenses = [expense("jan", 273.8, "2026-01-20T00:00:00Z", "default-services")];
const marchExpenses = [
  expense("future-installment-1", 49.9, "2026-03-01T00:00:00Z", "default-services"),
  expense("future-installment-2", 49.9, "2026-09-01T00:00:00Z", "default-services"),
  expense("future-installment-3", 49.9, "2026-10-01T00:00:00Z", "default-services"),
  expense("future-installment-4", 49.9, "2026-11-01T00:00:00Z", "default-services"),
];
const februaryStart = new Date(2026, 1, 1, 0, 0, 0, 0);
const februaryEnd = new Date(2026, 1, 28, 23, 59, 59, 999);
const selectedExpenses = filterRowsByCivilPeriod(
  [...januaryExpenses, ...februaryExpenses, ...marchExpenses],
  (row) => row.expense_date,
  februaryStart,
  februaryEnd,
);

// 7–11: classificação de fevereiro vem exclusivamente do category_id no mapa.
const totalsByCategory = new Map();
for (const row of selectedExpenses) {
  const category = resolveReportCategory({
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryIcon: row.category_icon,
  }, categories);
  totalsByCategory.set(category.name, Number(((totalsByCategory.get(category.name) || 0) + row.amount).toFixed(2)));
}
assert.deepEqual(Object.fromEntries(totalsByCategory), {
  "Caldas Novas": 279.9,
  "Serviços": 220.95,
  "Alimentação": 184.36,
  "Educação": 32.09,
});
assert.equal(selectedExpenses.length, 18);
assert.equal(sumRealizedAmounts(selectedExpenses), 717.3);
assert.equal(sumRealizedAmounts(selectedExpenses.filter((row) => row.payment_method === "pix")), 279.9);
assert.equal(sumRealizedAmounts(selectedExpenses.filter((row) => row.payment_method === "credit")), 437.4);
assert.equal(Number(calculatePercentageDelta(717.3, 273.8).toFixed(2)), 161.98);

// 12–17: snapshot selecionado exclui outros meses e mantém previsão separada.
assert.equal(selectedExpenses.some((row) => row.id === "jan"), false);
assert.equal(selectedExpenses.some((row) => row.id.startsWith("future-installment")), false);
assert.equal(reportCivilDateKey(selectedExpenses.find((row) => row.id === "food-1").expense_date), "2026-02-01");
const recurringTemplates = [
  { id: "feb-recurring", amount: 265.9, day_of_month: 15, is_active: true, start_date: "2026-02-01", end_date: null, created_at: "2026-02-01T00:00:00Z" },
  { id: "march-recurring", amount: 999, day_of_month: 1, is_active: true, start_date: "2026-03-01", end_date: null, created_at: "2026-03-01T00:00:00Z" },
];
const selectedRecurring = buildRecurringProjections(recurringTemplates, februaryStart, februaryEnd, new Date("2026-08-04T12:00:00-03:00"));
assert.equal(selectedRecurring.length, 1);
assert.equal(selectedRecurring[0].template.id, "feb-recurring");
assert.equal(selectedRecurring[0].projectedTotal, 265.9);
assert.equal(sumRealizedAmounts(selectedExpenses), 717.3, "previsão não altera realizado");

const reportsSource = read("src", "pages", "Reports.tsx");
const settingsSource = read("src", "pages", "Settings.tsx");
const viewModelSource = read("src", "utils", "report-view-model.ts");
const pdfSource = read("src", "services", "pdf-export-service.ts");
assert.match(reportsSource, /exportSelectedReportToPDF\(\{[\s\S]*viewModel,[\s\S]*startDate,[\s\S]*endDate,/u);
assert.doesNotMatch(pdfSource, /budget_goals|supabase\.from/u, "PDF selecionado não busca dados globais");
assert.match(pdfSource, /categoryData\.map/u, "PDF usa categorias agregadas no view model");
assert.match(pdfSource, /projection\.category\.name/u, "recorrências usam a categoria resolvida no view model");
assert.match(viewModelSource, /category: getCategoryDisplay/u);
assert.match(pdfSource, /reportTitle/u, "título contém o período selecionado");
assert.match(pdfSource, /Planejamento Recorrente/u);
assert.match(pdfSource, /não somado ao realizado/u);

// 18: meta com referência válida usa o mesmo mapa, nunca N/A.
const goalCategoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const goalCategories = [...categories, { id: goalCategoryId, name: "Meta personalizada", icon: "🎯" }];
assert.equal(resolveReportGoalCategory(goalCategoryId, goalCategories, {}), "Meta personalizada");
assert.equal(resolveReportGoalCategory("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", goalCategories, {}), "Categoria não resolvida");
assert.equal(resolveReportGoalCategory(null, goalCategories, {}), "Não se aplica");
assert.doesNotMatch(settingsSource, /goal\.category\s*\?[^\n]+:\s*["']N\/A["']/u);
assert.match(settingsSource, /Baixe todos os seus dados/u, "backup global permanece em Configurações");

// 19–21: datas civis e escopo protegido permanecem intactos.
assert.match(viewModelSource, /filterRowsByCivilPeriod\(expenses/u);
const changed = [
  ...lines(git(["diff", "--name-only", "HEAD"])),
  ...lines(git(["ls-files", "--others", "--exclude-standard"])),
].map((path) => path.replaceAll("\\", "/"));
const allowed = new Set([
  "package.json",
  "scripts/post-tools-p3-a-reports-business-rules-tests.mjs",
  "scripts/post-tools-p3-a1-report-civil-dates-tests.mjs",
  "scripts/post-tools-p3-a2-report-categories-export-tests.mjs",
  "src/components/reports-accordion.tsx",
  "src/pages/Reports.tsx",
  "src/pages/Settings.tsx",
  "src/services/pdf-export-service.ts",
  "src/utils/report-category-resolver.ts",
  "src/utils/report-view-model.ts",
  "tsconfig.p3a-reports.json",
]);
for (const path of changed) assert.ok(allowed.has(path), `arquivo fora do escopo P3-A2: ${path}`);
assert.equal(git(["diff", "--name-only", "HEAD", "--", "src/lib/mcp/shared", "src/lib/mcp/tools", "supabase/functions/mcp"]).trim(), "");
assert.equal(git(["diff", "--name-only", "HEAD", "--", "supabase/migrations"]).trim(), "");
assert.equal(readdirSync(join(root, "supabase", "migrations")).filter((name) => name.endsWith(".sql")).length, 64);

console.log("P3-A2: 21 grupos validados; categorias e exportação do período selecionado corretas.");
