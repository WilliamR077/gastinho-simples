import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { build } from "esbuild";

const bundled = await build({
  stdin: {
    contents: `export { analyzeInstallmentSeries } from "./src/lib/mcp/shared/installment-series-read.ts";`,
    resolveDir: process.cwd(),
    sourcefile: "post-tools-p2-entry.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
const core = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

const source = await readFile("src/lib/mcp/shared/installment-series-read.ts", "utf8");
const cardSource = await readFile("src/lib/mcp/tools/get-card-installments.ts", "utf8");
const bundleSource = await readFile("supabase/functions/mcp/index.ts", "utf8");
const sql = await readFile("docs/audits/post-tools-p2-installment-series-errors/diagnostic.sql", "utf8");
const report = await readFile("docs/audits/post-tools-p2-installment-series-errors/REPORT.md", "utf8");

assert.match(source, /warningPush\(warnings, "INSTALLMENT_DATE_INVALID"\)/u);
assert.match(source, /rows\.some\(\(row\) => !isValidIsoDate\(rowDate\(type, row\)\)\)/u);
assert.match(cardSource, /if \(installments\.length > 0\) seriesWarnings\.push\("SERIES_COMPLETENESS_NOT_VERIFIED"\)/u);
assert.match(bundleSource, /INSTALLMENT_DATE_INVALID/u);
assert.match(bundleSource, /SERIES_COMPLETENESS_NOT_VERIFIED/u);

const expenseGroup = "30000000-0000-4000-8000-000000000003";
const incomeGroup = "40000000-0000-4000-8000-000000000004";
const rowId = (number) => `90000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const baseRow = (type, number, total, date, overrides = {}) => ({
  id: rowId(number),
  description: `Synthetic ${number}/${total}`,
  amount: "1.00",
  expense_date: type === "expense" ? date : undefined,
  income_date: type === "income" ? date : undefined,
  category_id: type === "expense" ? "70000000-0000-4000-8000-000000000007" : undefined,
  income_category_id: type === "income" ? "80000000-0000-4000-8000-000000000008" : undefined,
  payment_method: type === "expense" ? "credit" : undefined,
  card_id: type === "expense" ? "60000000-0000-4000-8000-000000000006" : undefined,
  installment_group_id: type === "expense" ? expenseGroup : incomeGroup,
  installment_number: number,
  total_installments: total,
  shared_group_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-07-31T00:00:00.000Z",
  ...overrides,
});

const hasDateWarning = (type, rows) =>
  core.analyzeInstallmentSeries(type, type === "expense" ? expenseGroup : incomeGroup, rows)
    .warnings.includes("INSTALLMENT_DATE_INVALID");

const dateCases = [
  ["01 YYYY-MM-DD válido", "expense", [baseRow("expense", 1, 2, "2026-01-15"), baseRow("expense", 2, 2, "2026-02-15")], false],
  ["02 timestamp UTC em expense", "expense", [baseRow("expense", 1, 1, "2026-01-15T00:00:00.000Z")], true],
  ["03 timestamp com offset em income", "income", [baseRow("income", 1, 1, "2026-01-15T12:00:00-03:00")], false],
  ["04 string vazia", "expense", [baseRow("expense", 1, 1, "")], true],
  ["05 null", "expense", [baseRow("expense", 1, 1, null)], true],
  ["06 undefined", "expense", [baseRow("expense", 1, 1, undefined)], true],
  ["07 data impossível", "expense", [baseRow("expense", 1, 1, "2026-02-31")], true],
  ["08 31 janeiro + fevereiro civil", "expense", [baseRow("expense", 1, 2, "2026-01-31"), baseRow("expense", 2, 2, "2026-03-03")], false],
  ["09 30 janeiro + fevereiro civil", "expense", [baseRow("expense", 1, 2, "2026-01-30"), baseRow("expense", 2, 2, "2026-03-02")], false],
  ["10 29 fevereiro bissexto", "expense", [baseRow("expense", 1, 1, "2024-02-29")], false],
  ["11 fevereiro não bissexto", "expense", [baseRow("expense", 1, 1, "2026-02-28")], false],
  ["12 dezembro para janeiro", "expense", [baseRow("expense", 1, 2, "2026-12-31"), baseRow("expense", 2, 2, "2027-01-31")], false],
  ["13 timezone negativo", "income", [baseRow("income", 1, 1, "2026-01-01T00:30:00-05:00")], false],
  ["14 timezone positivo", "income", [baseRow("income", 1, 1, "2026-01-01T00:30:00+10:00")], false],
  ["15 date persistida", "expense", [baseRow("expense", 1, 1, "2026-07-31")], false],
  ["16 timestamp persistido", "income", [baseRow("income", 1, 1, "2026-07-31T03:00:00.000Z")], false],
  ["17 installment_number 1", "expense", [baseRow("expense", 1, 2, "2026-01-15")], false],
  ["18 parcela posterior", "expense", [baseRow("expense", 2, 2, "2026-02-15")], false],
  ["19 data anterior à primeira", "expense", [baseRow("expense", 1, 2, "2026-02-15"), baseRow("expense", 2, 2, "2026-01-15")], false],
  ["20 datas no mesmo mês", "expense", [baseRow("expense", 1, 2, "2026-01-01"), baseRow("expense", 2, 2, "2026-01-31")], false],
  ["21 lacuna de dois meses", "expense", [baseRow("expense", 1, 2, "2026-01-15"), baseRow("expense", 2, 2, "2026-04-15")], false],
  ["22 dia alterado, mês correto", "expense", [baseRow("expense", 1, 2, "2026-01-31"), baseRow("expense", 2, 2, "2026-02-28")], false],
  ["23 data impossível parseável em income", "income", [baseRow("income", 1, 1, "2026-02-31")], false],
];
for (const [label, type, rows, expected] of dateCases) {
  assert.equal(hasDateWarning(type, rows), expected, label);
}

// Reproduz literalmente o guard atual: ele não calcula completude; apenas marca
// qualquer página não vazia devolvida por get_card_installments.
const currentCompletenessGuard = ({ visibleRows = 1, queryError = false, source = "expenses" }) =>
  !queryError && source === "expenses" && visibleRows > 0;
const seriesCases = [
  ["01 1..N completa", 3, false, "expenses", true],
  ["02 falta parcela 1", 2, false, "expenses", true],
  ["03 falta intermediária", 2, false, "expenses", true],
  ["04 falta última", 2, false, "expenses", true],
  ["05 número duplicado", 3, false, "expenses", true],
  ["06 total divergente", 3, false, "expenses", true],
  ["07 total null", 1, false, "expenses", true],
  ["08 número null", 1, false, "expenses", true],
  ["09 group null mas total > 1", 1, false, "expenses", true],
  ["10 mesmo número duas vezes", 2, false, "expenses", true],
  ["11 fora de ordem", 3, false, "expenses", true],
  ["12 apenas uma parcela", 1, false, "expenses", true],
  ["13 uma parcela total=1 com group", 1, false, "expenses", true],
  ["14 parcial por mês", 1, false, "expenses", true],
  ["15 parcial por paginação", 20, false, "expenses", true],
  ["16 parcial por RLS", 1, false, "expenses", true],
  ["17 compartilhada", 3, false, "expenses", true],
  ["18 usuário member", 3, false, "expenses", true],
  ["19 usuário owner", 3, false, "expenses", true],
  ["20 mistura user_id visível", 3, false, "expenses", true],
  ["21 mistura shared_group_id", 3, false, "expenses", true],
  ["22 datas incoerentes", 3, false, "expenses", true],
  ["23 datas coerentes e número faltante", 2, false, "expenses", true],
  ["24 query com erro", 0, true, "expenses", false],
  ["25 query vazia", 0, false, "expenses", false],
  ["26 resposta acima do limite", 100, false, "expenses", true],
  ["27 total menor que max", 3, false, "expenses", true],
  ["28 total maior que quantidade", 2, false, "expenses", true],
  ["29 parcela N+1", 4, false, "expenses", true],
  ["30 mesmo UUID em incomes", 3, false, "incomes", false],
];
for (const [label, visibleRows, queryError, sourceTable, expected] of seriesCases) {
  assert.equal(currentCompletenessGuard({ visibleRows, queryError, source: sourceTable }), expected, label);
}

const changed = execFileSync("git", ["diff", "--name-only", "main", "--"], { encoding: "utf8" })
  .trim().split(/\r?\n/u).filter(Boolean).map((path) => path.replaceAll("\\", "/"));
const allowed = new Set([
  "docs/audits/post-tools-p2-installment-series-errors/REPORT.md",
  "docs/audits/post-tools-p2-installment-series-errors/diagnostic.sql",
  "scripts/post-tools-p2-installment-series-tests.mjs",
  "package.json",
]);
assert.ok(changed.every((path) => allowed.has(path)), `arquivo fora do escopo: ${changed.join(", ")}`);
const statusPaths = execFileSync(
  "git",
  ["status", "--porcelain=v1", "--untracked-files=all"],
  { encoding: "utf8" },
).trimEnd().split(/\r?\n/u).filter(Boolean)
  .map((line) => line.slice(3).replaceAll("\\", "/"));
assert.ok(
  statusPaths.every((path) => allowed.has(path)),
  `status contém arquivo fora do escopo: ${statusPaths.join(", ")}`,
);
assert.equal(execFileSync("git", ["diff", "--name-only", "main", "--", "supabase/migrations"], { encoding: "utf8" }), "");
assert.equal((await readdir("supabase/migrations")).filter((name) => name.endsWith(".sql")).length, 64);
for (const protectedPath of ["src/", "supabase/functions/", "supabase/migrations/"]) {
  assert.ok(!changed.some((path) => path.startsWith(protectedPath)), `${protectedPath} alterado`);
}

const sqlWithoutComments = sql.replace(/--.*$/gmu, "").replace(/\/\*[\s\S]*?\*\//gu, "");
const forbiddenSql = /\b(INSERT|UPDATE|DELETE|UPSERT|MERGE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE|CALL|COPY)\b/iu;
assert.equal(forbiddenSql.test(sqlWithoutComments), false, "SQL contém comando proibido");
for (const statement of sqlWithoutComments.split(";").map((item) => item.trim()).filter(Boolean)) {
  assert.match(statement, /^(SELECT|WITH)\b/iu, "cada statement deve ser SELECT ou WITH");
}
assert.match(sql, /public\.expenses/u);
assert.match(sql, /public\.incomes/u);
assert.doesNotMatch(sql, /auth\.users/iu);
for (const privateField of ["description", "amount", "email", "phone", "token", "card_name", "notes"]) {
  assert.doesNotMatch(sql, new RegExp(`\\b${privateField}\\b`, "iu"));
}
assert.match(report, /independentes/u);
assert.match(report, /Nenhum SQL remoto foi executado/iu);

console.log(`P2-A: ${dateCases.length} casos de data, ${seriesCases.length} cenários de série e invariantes de escopo aprovados.`);
