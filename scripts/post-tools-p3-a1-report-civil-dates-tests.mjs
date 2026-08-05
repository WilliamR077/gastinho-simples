import assert from "node:assert/strict";
import { P3A4_ALLOWED_PATHS, P3A4_INFRASTRUCTURE_MIGRATION } from "./p3a4-scope-files.mjs";
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
  calculatePercentageDelta,
  filterRowsByCivilPeriod,
  parseReportCivilDate,
  reportCivilDateKey,
  reportDateKey,
  sumRealizedAmounts,
} = rules;
const { resolveReportCategory } = categoryRules;

const month = (year, monthIndex) => ({
  start: new Date(year, monthIndex, 1, 0, 0, 0, 0),
  end: new Date(year, monthIndex + 1, 0, 23, 59, 59, 999),
});
const expense = (id, amount, expenseDate, paymentMethod, categoryId, categoryName = "Outros") => ({
  id,
  amount,
  expense_date: expenseDate,
  payment_method: paymentMethod,
  category_id: categoryId,
  category_name: categoryName,
  category_icon: "📦",
});

// 1–7: uma transação financeira preserva o prefixo civil persistido.
for (const [input, expected] of [
  ["2026-02-01", "2026-02-01"],
  ["2026-02-01T00:00:00Z", "2026-02-01"],
  ["2026-02-01T00:00:00-03:00", "2026-02-01"],
  ["2026-03-01T00:00:00Z", "2026-03-01"],
  ["2026-12-31T00:00:00Z", "2026-12-31"],
  ["2027-01-01T00:00:00Z", "2027-01-01"],
  ["2024-02-29T00:00:00Z", "2024-02-29"],
]) {
  assert.equal(reportDateKey(parseReportCivilDate(input)), expected, input);
}
assert.throws(() => parseReportCivilDate("2026-02-29T00:00:00Z"), /Data civil inválida/u);

const categories = [
  { id: "cat-caldas", name: "Caldas Novas", icon: "🏖️" },
  { id: "cat-services", name: "Serviços", icon: "🔧" },
  { id: "cat-food", name: "Alimentação", icon: "🍔" },
  { id: "cat-education", name: "Educação", icon: "📚" },
];

const februaryExpenses = [
  expense("caldas-1", 150, "2026-02-05T00:00:00Z", "pix", "cat-caldas"),
  expense("caldas-2", 129.9, "2026-02-20T00:00:00-03:00", "pix", "cat-caldas"),
  expense("service-1", 191.75, "2026-02-14T00:00:00Z", "credit", "cat-services"),
  expense("service-2", 30, "2026-02-04T00:00:00Z", "credit", "cat-services"),
  expense("service-3", 20, "2026-02-06T00:00:00Z", "credit", "cat-services"),
  expense("service-4", 15.09, "2026-02-08T00:00:00Z", "credit", "cat-services"),
  expense("service-5", 10, "2026-02-10T00:00:00Z", "credit", "cat-services"),
  expense("service-6", 10, "2026-02-12T00:00:00Z", "credit", "cat-services"),
  expense("food-1", 20.9, "2026-02-01T00:00:00Z", "credit", "cat-food"),
  expense("food-2", 20, "2026-02-01T00:00:00-03:00", "credit", "cat-food"),
  expense("food-3", 20, "2026-02-02T00:00:00Z", "credit", "cat-food"),
  expense("food-4", 20, "2026-02-03T00:00:00Z", "credit", "cat-food"),
  expense("food-5", 20, "2026-02-07T00:00:00Z", "credit", "cat-food"),
  expense("food-6", 15, "2026-02-09T00:00:00Z", "credit", "cat-food"),
  expense("food-7", 12.57, "2026-02-11T00:00:00Z", "credit", "cat-food"),
  expense("education-1", 12.09, "2026-02-15T00:00:00Z", "credit", "cat-education"),
  expense("education-2", 10, "2026-02-16T00:00:00Z", "credit", "cat-education"),
  expense("education-3", 10, "2026-02-18T00:00:00Z", "credit", "cat-education"),
];
const januaryExpenses = [
  expense("jan-1", 100, "2026-01-15T00:00:00Z", "credit", "cat-services"),
  expense("jan-2", 173.8, "2026-01-20T00:00:00Z", "credit", "cat-services"),
];
const marchIntruders = [
  expense("mar-1", 10, "2026-03-01T00:00:00Z", "credit", "cat-services"),
  expense("mar-2", 19.99, "2026-03-01T00:00:00-03:00", "credit", "cat-services"),
];
const allExpenses = [...januaryExpenses, ...februaryExpenses, ...marchIntruders];

// 8–12: oráculos de totais, comparação e pagamentos.
const feb = month(2026, 1);
const jan = month(2026, 0);
const filteredFebruary = filterRowsByCivilPeriod(allExpenses, (row) => row.expense_date, feb.start, feb.end);
const filteredJanuary = filterRowsByCivilPeriod(allExpenses, (row) => row.expense_date, jan.start, jan.end);
assert.equal(filteredFebruary.length, 18);
assert.equal(sumRealizedAmounts(filteredFebruary), 717.3);
assert.equal(sumRealizedAmounts(filteredJanuary), 273.8);
assert.notEqual(sumRealizedAmounts(filteredFebruary), 706.39);
assert.notEqual(sumRealizedAmounts(filteredJanuary), 314.7);
assert.equal(Number(calculatePercentageDelta(717.3, 273.8).toFixed(2)), 161.98);
assert.notEqual(Math.round(calculatePercentageDelta(717.3, 273.8)), 124);
const paymentTotals = Object.groupBy(filteredFebruary, (row) => row.payment_method);
assert.equal(sumRealizedAmounts(paymentTotals.pix), 279.9);
assert.equal(sumRealizedAmounts(paymentTotals.credit), 437.4);

// 13–15: agrupamento diário, ranking e gráficos usam a mesma chave civil.
const dayTotals = new Map();
for (const row of filteredFebruary) {
  const key = reportCivilDateKey(row.expense_date);
  dayTotals.set(key, Number(((dayTotals.get(key) || 0) + row.amount).toFixed(2)));
}
const [largestDay, largestDayValue] = [...dayTotals].sort((a, b) => b[1] - a[1])[0];
assert.equal(largestDay, "2026-02-14");
assert.equal(largestDayValue, 191.75);
assert.equal(dayTotals.get("2026-02-01"), 40.9);
assert.equal(dayTotals.has("2026-03-01"), false);
const ranking = [...filteredFebruary].sort((a, b) => b.amount - a.amount);
assert.equal(reportCivilDateKey(ranking[0].expense_date), "2026-02-14");
assert.equal(reportDateKey(parseReportCivilDate(ranking[0].expense_date)), "2026-02-14");
for (const [description, persisted, displayed] of [
  ["Lovable", "2026-02-14T00:00:00Z", "2026-02-14"],
  ["Backend ICB", "2026-02-04T00:00:00Z", "2026-02-04"],
  ["Moranguinho", "2026-02-02T00:00:00Z", "2026-02-02"],
  ["Curso", "2026-02-15T00:00:00Z", "2026-02-15"],
]) {
  assert.equal(reportCivilDateKey(persisted), displayed, description);
}

// 16: category_id válido vence um fallback desnormalizado "Outros".
const categoryTotals = new Map();
for (const row of filteredFebruary) {
  const resolved = resolveReportCategory({
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryIcon: row.category_icon,
  }, categories);
  categoryTotals.set(resolved.name, Number(((categoryTotals.get(resolved.name) || 0) + row.amount).toFixed(2)));
}
assert.deepEqual(Object.fromEntries(categoryTotals), {
  "Caldas Novas": 279.9,
  "Serviços": 276.84,
  "Alimentação": 128.47,
  "Educação": 32.09,
});
assert.equal(resolveReportCategory({ categoryId: "cat-caldas", categoryName: "Outros" }, categories).name, "Caldas Novas");
assert.equal(resolveReportCategory({ categoryId: "missing", categoryName: "Outros" }, categories).name, "Outros");
assert.equal(resolveReportCategory({ categoryId: "group-category", categoryName: "Viagem" }, categories).name, "Viagem");

const viewModelSource = read("src", "utils", "report-view-model.ts");
const accordionSource = read("src", "components", "reports-accordion.tsx");
const pdfSource = read("src", "services", "pdf-export-service.ts");
assert.match(viewModelSource, /filterRowsByCivilPeriod\(expenses/u);
assert.match(viewModelSource, /reportCivilDateKey\(e\.expense_date\)/u);
assert.match(viewModelSource, /resolveReportCategory/u);
assert.match(accordionSource, /parseReportCivilDate\(e\.date\)/u);
assert.match(pdfSource, /categoryData\.map/u, "PDF usa o mapa agregado da interface");
assert.match(pdfSource, /parseReportCivilDate\(e\.date\)/u, "PDF usa a regra civil do ranking");
assert.doesNotMatch(`${viewModelSource}\n${accordionSource}\n${pdfSource}`, /parseReportDate/u);

// 17–18: escopo protegido.
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
  "src/pages/Settings.tsx",
  "src/services/pdf-export-service.ts",
  "src/utils/report-business-rules.ts",
  "src/utils/report-category-resolver.ts",
  "src/utils/report-load-state.ts",
  "src/utils/report-view-model.ts",
  "tsconfig.p3a-reports.json",
]);
for (const path of changed) assert.ok(allowed.has(path) || P3A4_ALLOWED_PATHS.has(path), `arquivo fora do escopo P3-A1/P3-A2/P3-A3/P3-A4: ${path}`);
assert.equal(git(["diff", "--name-only", "HEAD", "--", "src/lib/mcp/shared", "src/lib/mcp/tools", "supabase/functions/mcp"]).trim(), "");
assert.deepEqual(git(["diff", "--name-only", "HEAD", "--", "supabase/migrations"]).trim().split(/\r?\n/u).filter(Boolean), []);
assert.equal(readdirSync(join(root, "supabase", "migrations")).filter((name) => name.endsWith(".sql")).length, 65);
assert.ok(P3A4_INFRASTRUCTURE_MIGRATION.endsWith("p3a4_category_history_operations.sql"));

console.log("P3-A1: 18 grupos validados; datas civis, oráculos e categorias do PDF corretos.");
