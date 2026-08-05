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

const loadRules = await importTypeScript("src", "utils", "report-load-state.ts");
const categoryRules = await importTypeScript("src", "utils", "report-category-resolver.ts");
const businessRules = await importTypeScript("src", "utils", "report-business-rules.ts");
const { initialReportLoadState, isReportViewReady, reduceReportLoadState } = loadRules;
const { resolveReportCategory } = categoryRules;
const { filterRowsByCivilPeriod, sumRealizedAmounts } = businessRules;

const start = (state, selectionKey, requestId) => reduceReportLoadState(state, { type: "start", selectionKey, requestId });
const success = (state, selectionKey, requestId, data) => reduceReportLoadState(state, { type: "success", selectionKey, requestId, data });

// 1: abrir diretamente fevereiro.
let state = initialReportLoadState();
state = start(state, "personal:february", 1);
assert.equal(state.loading, true);
assert.equal(state.data, null);
state = success(state, "personal:february", 1, { month: "february" });
assert.deepEqual(state.data, { month: "february" });

// 2: abrir agosto e mudar para fevereiro; resposta antiga não volta à tela.
state = start(state, "personal:august", 2);
state = success(state, "personal:august", 2, { month: "august" });
state = start(state, "personal:february", 3);
assert.equal(state.data, null);
state = success(state, "personal:august", 2, { month: "august-late" });
assert.equal(state.data, null);
state = success(state, "personal:february", 3, { month: "february" });
assert.equal(state.data.month, "february");

// 3: agosto → fevereiro → janeiro rapidamente; só a última seleção vence.
state = start(state, "personal:august", 4);
state = start(state, "personal:february", 5);
state = start(state, "personal:january", 6);
state = success(state, "personal:february", 5, { month: "february-late" });
state = success(state, "personal:august", 4, { month: "august-late" });
assert.equal(state.data, null);
state = success(state, "personal:january", 6, { month: "january" });
assert.equal(state.data.month, "january");

// 4–6: atraso e ordens distintas entre categorias e dados mantêm skeleton.
state = start(state, "personal:february", 7);
assert.equal(isReportViewReady(state, true), false);
state = success(state, "personal:february", 7, { month: "february" });
assert.equal(isReportViewReady(state, true), false, "dados antes das categorias");
state = start(state, "personal:february", 8);
assert.equal(isReportViewReady(state, false), false, "categorias antes dos dados");
state = success(state, "personal:february", 8, { month: "february" });
assert.equal(isReportViewReady(state, false), true);

// 7–9: troca pessoal/grupo é atômica e nunca mantém snapshot anterior.
state = start(state, "personal:user", 9);
state = success(state, "personal:user", 9, { context: "personal" });
state = start(state, "group:family", 10);
assert.equal(state.data, null);
state = success(state, "personal:user", 9, { context: "personal-late" });
assert.equal(state.data, null);
state = success(state, "group:family", 10, { context: "group" });
assert.equal(state.data.context, "group");
state = start(state, "personal:user", 11);
assert.equal(state.data, null);
state = success(state, "personal:user", 11, { context: "personal" });
assert.equal(state.data.context, "personal");

const categories = [
  { id: "services", name: "Serviços", icon: "🔧" },
  { id: "food", name: "Alimentação", icon: "🍔" },
  { id: "education", name: "Educação", icon: "📚" },
];
const expense = (id, amount, date, categoryId, categoryName = null, legacyLabel = null) => ({
  id,
  amount,
  expense_date: date,
  category_id: categoryId,
  category_name: categoryName,
  legacyLabel,
});
const february = [
  expense("other", 279.9, "2026-02-05T00:00:00Z", null, null, "Outros"),
  expense("service", 220.95, "2026-02-14T00:00:00Z", "services", "Outros"),
  expense("food", 184.36, "2026-02-20T00:00:00-03:00", "food", "Outros"),
  expense("education", 32.09, "2026-02-15T00:00:00Z", "education", "Outros"),
];
const august = [
  expense("Notebook", 320.52, "2026-08-01T00:00:00Z", "unknown-notebook"),
  expense("39 figurinhas", 39, "2026-08-01T00:00:00Z", "unknown-stickers"),
  expense("Mc", 24.9, "2026-08-01T00:00:00Z", "unknown-food"),
];
const februaryStart = new Date(2026, 1, 1, 0, 0, 0, 0);
const februaryEnd = new Date(2026, 1, 28, 23, 59, 59, 999);
const selected = filterRowsByCivilPeriod([...february, ...august], (row) => row.expense_date, februaryStart, februaryEnd);

const summarize = (rows) => {
  const buckets = new Map();
  for (const row of rows) {
    const category = resolveReportCategory({
      categoryId: row.category_id,
      categoryName: row.category_name,
      legacyLabel: row.legacyLabel,
    }, categories);
    const current = buckets.get(category.key) || { key: category.key, name: category.name, value: 0 };
    current.value = Number((current.value + row.amount).toFixed(2));
    buckets.set(category.key, current);
  }
  return [...buckets.values()].sort((a, b) => b.value - a.value);
};

// 10–11: soma e subtítulo derivam da mesma lista renderizada.
const categoryData = summarize(selected);
assert.equal(sumRealizedAmounts(selected), 717.3);
assert.equal(Number(categoryData.reduce((sum, item) => sum + item.value, 0).toFixed(2)), 717.3);
assert.equal(categoryData.length, 4);
assert.deepEqual(categoryData.map(({ name, value }) => ({ name, value })), [
  { name: "Outros", value: 279.9 },
  { name: "Serviços", value: 220.95 },
  { name: "Alimentação", value: 184.36 },
  { name: "Educação", value: 32.09 },
]);

// 12–13: não resolvidos atuais agregam; não resolvidos externos não contaminam.
const currentUnresolved = summarize([
  expense("current-a", 10, "2026-02-10T00:00:00Z", "missing-a"),
  expense("current-b", 5, "2026-02-11T00:00:00Z", "missing-b"),
]);
assert.deepEqual(currentUnresolved, [{ key: "unresolved", name: "Categoria não resolvida", value: 15 }]);
assert.equal(categoryData.some((item) => [320.52, 39, 24.9].includes(item.value)), false);
assert.equal(Number(categoryData.reduce((sum, item) => sum + item.value, 0).toFixed(2)), 717.3);

// 14: UI e PDF usam o mesmo summary; títulos do PDF têm linhas verticais próprias.
const reportsSource = read("src", "pages", "Reports.tsx");
const accordionSource = read("src", "components", "reports-accordion.tsx");
const viewModelSource = read("src", "utils", "report-view-model.ts");
const resolverSource = read("src", "utils", "report-category-resolver.ts");
const pdfSource = read("src", "services", "pdf-export-service.ts");
const settingsSource = read("src", "pages", "Settings.tsx");
assert.match(reportsSource, /reduceReportLoadState/u);
assert.match(reportsSource, /Promise\.all\(/u);
assert.match(reportsSource, /reportViewReady \? \(/u);
assert.match(reportsSource, /key=\{reportRenderKey\}/u);
assert.doesNotMatch(accordionSource, /supabase|useCategories|resolveReportCategory/u, "componente não consulta nem resolve categorias em paralelo");
assert.match(accordionSource, /categoryData\.map/u);
assert.match(accordionSource, /key=\{cat\.key\}/u);
assert.match(viewModelSource, /filteredExpenses\.forEach/u);
assert.match(resolverSource, /key: "unresolved"/u);
assert.match(pdfSource, /body: categoryData\.map/u);
assert.match(pdfSource, /Fluxo de Caixa Realizado'[\s\S]{0,160}yPosition \+= 5;[\s\S]{0,220}Entradas vs Saídas — Por dia'[\s\S]{0,160}yPosition \+= 6;/u);
assert.match(pdfSource, /Evolução dos Gastos Realizados'[\s\S]{0,160}yPosition \+= 5;[\s\S]{0,240}Diário — Média:[\s\S]{0,180}yPosition \+= 6;/u);
assert.match(settingsSource, /Baixe todos os seus dados/u, "PDF global permanece em Configurações");

const changed = [
  ...lines(git(["diff", "--name-only", "HEAD"])),
  ...lines(git(["ls-files", "--others", "--exclude-standard"])),
].map((path) => path.replaceAll("\\", "/"));
const allowed = new Set([
  "package.json",
  "scripts/post-tools-p3-a-reports-business-rules-tests.mjs",
  "scripts/post-tools-p3-a1-report-civil-dates-tests.mjs",
  "scripts/post-tools-p3-a2-report-categories-export-tests.mjs",
  "scripts/post-tools-p3-a3-report-category-state-tests.mjs",
  "src/components/reports-accordion.tsx",
  "src/pages/Reports.tsx",
  "src/services/pdf-export-service.ts",
  "src/utils/report-category-resolver.ts",
  "src/utils/report-load-state.ts",
  "src/utils/report-view-model.ts",
  "tsconfig.p3a-reports.json",
]);
for (const path of changed) assert.ok(allowed.has(path), `arquivo fora do escopo P3-A3: ${path}`);
assert.equal(git(["diff", "--name-only", "HEAD", "--", "src/lib/mcp/shared", "src/lib/mcp/tools", "supabase/functions/mcp"]).trim(), "");
assert.equal(git(["diff", "--name-only", "HEAD", "--", "supabase/migrations"]).trim(), "");
assert.equal(readdirSync(join(root, "supabase", "migrations")).filter((name) => name.endsWith(".sql")).length, 64);

console.log("P3-A3: 14 grupos validados; estado por período/contexto e títulos do PDF corretos.");
