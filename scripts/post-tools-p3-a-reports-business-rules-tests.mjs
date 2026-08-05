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
const section = (source, start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `seção ausente: ${start}`);
  return source.slice(from, to);
};

const rulesPath = join(root, "src", "utils", "report-business-rules.ts");
const compiled = ts.transpileModule(readFileSync(rulesPath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const rules = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`);

const {
  buildRecurringProjections,
  calculatePercentageDelta,
  calculateRealizedSavingsRate,
  classifyReportPeriod,
  parseReportCivilDate,
  recurringOccurrencesInPeriod,
  reportDateKey,
  sumRealizedAmounts,
} = rules;

const month = (year, monthIndex) => ({
  start: new Date(year, monthIndex, 1, 0, 0, 0, 0),
  end: new Date(year, monthIndex + 1, 0, 23, 59, 59, 999),
});
const recurring = (overrides = {}) => ({
  id: "template-1",
  amount: 100,
  day_of_month: 10,
  is_active: true,
  start_date: "2025-01-01",
  end_date: null,
  created_at: "2025-01-01T12:00:00-03:00",
  ...overrides,
});

// 1–5: realizado, previsão, vínculo explícito e ausência de dupla contagem.
assert.equal(sumRealizedAmounts([{ amount: 10 }, { amount: 20.5 }]), 30.5);
const feb = month(2026, 1);
assert.equal(buildRecurringProjections([], feb.start, feb.end).length, 0);
const linked = buildRecurringProjections(
  [recurring()], feb.start, feb.end, new Date("2026-02-05T12:00:00-03:00"), new Set(["template-1"]),
);
assert.equal(linked.length, 0, "um vínculo explícito e confiável retira a previsão materializada");
const unlinked = buildRecurringProjections([recurring()], feb.start, feb.end, new Date("2026-02-05T12:00:00-03:00"));
assert.equal(unlinked.length, 1, "sem vínculo, template permanece separado e não é deduzido por heurística");
assert.equal(sumRealizedAmounts([{ amount: 40 }]), 40, "template nunca altera total realizado");

// 6–13: relação temporal, status neutro e janela de atividade.
const currentPeriod = month(2026, 7);
assert.equal(classifyReportPeriod(currentPeriod.start, currentPeriod.end, new Date("2026-08-03T12:00:00-03:00")), "current");
assert.equal(classifyReportPeriod(feb.start, feb.end, new Date("2026-08-03T12:00:00-03:00")), "historical");
const futurePeriod = month(2026, 8);
assert.equal(classifyReportPeriod(futurePeriod.start, futurePeriod.end, new Date("2026-08-03T12:00:00-03:00")), "future");
const pending = buildRecurringProjections([recurring({ day_of_month: 17 })], currentPeriod.start, currentPeriod.end, new Date("2026-08-03T12:00:00-03:00"))[0];
assert.equal(pending.statusLabel, "Pendente de lançamento");
assert.match(pending.dueLabel, /^Vence em 14 dias$/u);
const historical = buildRecurringProjections([recurring({ day_of_month: 17 })], feb.start, feb.end, new Date("2026-08-03T12:00:00-03:00"))[0];
assert.equal(historical.statusLabel, "Sem confirmação de lançamento");
assert.doesNotMatch(historical.dueLabel, /Vence em/u);
assert.match(historical.dueLabel, /17\/02\/2026/u);
assert.equal(buildRecurringProjections([recurring({ is_active: false, end_date: null })], feb.start, feb.end).length, 0);
assert.equal(buildRecurringProjections([recurring({ is_active: false, end_date: "2026-02-28" })], feb.start, feb.end).length, 1);
assert.equal(buildRecurringProjections([recurring({ start_date: "2026-03-01" })], feb.start, feb.end).length, 0);
assert.equal(buildRecurringProjections([recurring({ end_date: "2026-01-31" })], feb.start, feb.end).length, 0);

// 14–21: métricas realizadas e fontes dos componentes.
assert.equal(calculateRealizedSavingsRate(1000, 250), 75);
assert.equal(calculateRealizedSavingsRate(0, 250), 0);
assert.equal(calculateRealizedSavingsRate(-10, 250), 0);
const viewModelSource = read("src", "utils", "report-view-model.ts");
assert.match(viewModelSource, /const totalPeriod = sumRealizedAmounts\(filteredExpenses\)/u);
assert.match(viewModelSource, /const totalIncomes = sumRealizedAmounts\(filteredIncomes\)/u);
for (const [name, start, end] of [
  ["categorias", "// Category data", "// Payment method data"],
  ["forma de pagamento", "// Payment method data", "// Card data"],
  ["cartões", "// Card data", "// Member data"],
  ["fluxo", "// Fluxo realizado", "// Evolução realizada"],
  ["evolução", "// Evolução realizada", "const days ="],
  ["maiores gastos", "// Top expenses", "const topExpenses:"],
]) {
  assert.doesNotMatch(section(viewModelSource, start, end), /filteredRecurring/u, `${name}: apenas realizado`);
}

// 22–25: valores-oráculo de janeiro/fevereiro e comparação correta.
const januaryRealized = sumRealizedAmounts([{ amount: 100 }, { amount: 173.8 }]);
const januaryForecast = buildRecurringProjections(
  [recurring({ id: "gastinho", amount: 14.9 })], month(2026, 0).start, month(2026, 0).end,
)[0].projectedTotal;
assert.equal(januaryRealized, 273.8);
assert.equal(januaryForecast, 14.9);
const februaryRealized = sumRealizedAmounts([{ amount: 300 }, { amount: 417.3 }]);
const februaryForecast = buildRecurringProjections([
  recurring({ id: "saude", amount: 251 }),
  recurring({ id: "gastinho", amount: 14.9 }),
], feb.start, feb.end).reduce((sum, item) => sum + item.projectedTotal, 0);
assert.equal(februaryRealized, 717.3);
assert.equal(februaryForecast, 265.9);
assert.notEqual(februaryRealized, 983.2);
const oracleDelta = calculatePercentageDelta(februaryRealized, januaryRealized);
assert.ok(Math.abs(oracleDelta - 161.9795) < 0.001);
assert.notEqual(Math.round(oracleDelta), 241);

// 26–27: histórico e timezone America/Sao_Paulo, incluindo bordas.
assert.equal(reportDateKey(parseReportCivilDate("2026-02-01")), "2026-02-01");
assert.equal(reportDateKey(parseReportCivilDate("2026-02-01T00:00:00Z")), "2026-02-01");
assert.equal(reportDateKey(parseReportCivilDate("2026-02-01T00:00:00-03:00")), "2026-02-01");
assert.equal(reportDateKey(parseReportCivilDate("2026-03-01T00:00:00Z")), "2026-03-01");
assert.equal(reportDateKey(parseReportCivilDate("2024-02-29")), "2024-02-29");
assert.equal(reportDateKey(parseReportCivilDate("2027-01-01T00:00:00Z")), "2027-01-01");
assert.equal(recurringOccurrencesInPeriod(recurring({ day_of_month: 31, start_date: "2020-01-01" }), month(2024, 1).start, month(2024, 1).end)[0].getDate(), 29);

// 28–33: escopo, exportação, ausência de mutação remota e responsividade/tema.
const reportsSource = read("src", "pages", "Reports.tsx");
assert.doesNotMatch(reportsSource, /\.(?:insert|update|upsert|delete|rpc)\s*\(/u, "Relatórios não altera dados remotos");
assert.doesNotMatch(
  `${section(reportsSource, "const fetchRecurringExpenses", "const fetchCards")}\n${section(reportsSource, "const fetchRecurringIncomes", "useEffect(() =>")}`,
  /\.eq\("is_active", true\)/u,
  "histórico carrega templates encerrados",
);
const pdfSource = read("src", "services", "pdf-export-service.ts");
assert.match(pdfSource, /categoryData\.map/u, "PDF usa as mesmas categorias resolvidas da interface");
const categoryResolverSource = read("src", "utils", "report-category-resolver.ts");
assert.match(categoryResolverSource, /name: "Categoria não resolvida"/u, "category_id válido não é mascarado como Outros");
assert.match(viewModelSource, /resolveReportCategory/u, "interface e PDF compartilham o resolvedor canônico");
const accordionSource = read("src", "components", "reports-accordion.tsx");
assert.match(`${reportsSource}\n${accordionSource}`, /sm:/u, "layout contém variantes responsivas para desktop");
assert.match(accordionSource, /grid-cols-2|grid-cols-3/u, "layout mobile mantém grade compacta");
assert.match(accordionSource, /bg-card|text-foreground/u, "cores usam tokens compatíveis com temas claro/escuro");
assert.doesNotMatch(accordionSource, /isPaid|"Paga"/u, "status pago não é inferido pela data atual");

const changed = [
  ...lines(git(["diff", "--name-only", "HEAD"])),
  ...lines(git(["ls-files", "--others", "--exclude-standard"])),
].map((path) => path.replaceAll("\\", "/"));
const allowed = [
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
];
for (const path of changed) {
  assert.ok(allowed.includes(path) || P3A4_ALLOWED_PATHS.has(path), `arquivo fora do escopo P3-A/P3-A1/P3-A2/P3-A3/P3-A4: ${path}`);
}
for (const path of changed) {
  assert.doesNotMatch(path, /^(?:src\/lib\/mcp|supabase\/functions\/mcp)(?:\/|$)/u, "nenhum arquivo MCP alterado");
  if (path.startsWith("supabase/migrations/")) assert.equal(path, P3A4_INFRASTRUCTURE_MIGRATION);
}
assert.equal(readdirSync(join(root, "supabase", "migrations")).filter((name) => name.endsWith(".sql")).length, 65);
assert.equal(git(["diff", "--name-only", "HEAD", "--", "src/lib/mcp/shared", "src/lib/mcp/tools", "supabase/functions/mcp"]).trim(), "");

console.log("P3-A: 33 grupos de regressão validados; realizado e previsão permanecem separados.");
