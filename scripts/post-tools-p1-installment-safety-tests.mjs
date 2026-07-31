import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = join(root, "src", "pages", "Index.tsx");
const expenseListPath = join(root, "src", "components", "expense-list.tsx");
const incomeListPath = join(root, "src", "components", "income-list.tsx");
const indexSource = readFileSync(indexPath, "utf8");
const expenseListSource = readFileSync(expenseListPath, "utf8");
const incomeListSource = readFileSync(incomeListPath, "utf8");

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function lines(value) {
  return value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
}

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `seção ausente: ${start}`);
  return source.slice(startIndex, endIndex);
}

const loadExpenses = section(indexSource, "const loadExpenses = async", "const loadRecurringExpenses = async");
const loadIncomes = section(indexSource, "const loadIncomes = async", "const loadRecurringIncomes = async");
const deleteIncome = section(indexSource, "const deleteIncome = async", "const deleteRecurringIncome = async");
const deleteExpense = section(indexSource, "const deleteExpense = async", "const addRecurringExpense = async");
const readFlows = `${loadExpenses}\n${loadIncomes}`;

// Esta é a asserção principal de regressão: ela falha na implementação anterior,
// que continha dois `.delete()` e removia itens do estado dentro destes loaders.
assert.doesNotMatch(readFlows, /\.delete\s*\(/u, "leitura nunca pode executar DELETE");
assert.doesNotMatch(readFlows, /\.(?:insert|update|upsert)\s*\(/u, "leitura não pode mutar parcelas");
assert.doesNotMatch(readFlows, /\.rpc\s*\(/u, "leitura não pode chamar RPC potencialmente mutável");
assert.doesNotMatch(readFlows, /\b(?:orphan|orphaned|cleanup)\b/iu, "loader não pode inferir orfandade");
assert.doesNotMatch(readFlows, /method\s*:\s*["']DELETE["']/iu, "leitura não pode emitir HTTP DELETE");
assert.match(loadExpenses, /setExpenses\(expensesWithSplits\)/u, "despesas retornadas são preservadas");
assert.match(loadIncomes, /setIncomes\(\(data \|\| \[\]\) as Income\[\]\)/u, "receitas retornadas são preservadas");

const installment = { id: "installment-2", installment_group_id: "series-a", installment_number: 2 };
const previous = [{ id: "previous-context", installment_group_id: "series-old", installment_number: 1 }];
const scenarios = [
  ["primeiro render com lista vazia", { data: [], settled: true }],
  ["query loading", { data: [], loading: true }],
  ["query fetching", { data: previous, fetching: true }],
  ["query com erro", { data: previous, error: new Error("network") }],
  ["resposta parcial", { data: [installment], settled: true }],
  ["paginação incompleta", { data: [installment], hasNextPage: true }],
  ["filtro oculta registro pai", { data: [installment], filtered: true }],
  ["mudança de mês", { data: [installment], monthChanged: true }],
  ["mudança de grupo", { data: [installment], groupChanged: true }],
  ["mudança de usuário", { data: [installment], userChanged: true }],
  ["logout/login rápido", { data: [installment], authChanging: true }],
  ["cache não hidratado", { data: [], cacheHydrated: false }],
  ["cache com dados anteriores", { data: previous, cacheHydrated: true }],
  ["refresh concorrente", { data: [installment], concurrentRefresh: true }],
  ["realtime antes da query principal", { data: [installment], realtimeFirst: true }],
  ["parent carregado depois da parcela", { data: [installment], parentLater: true }],
  ["parcela carregada depois do parent", { data: [{ ...installment, installment_number: 1 }], childLater: true }],
  ["parent temporariamente ausente", { data: [installment], parentMissing: true }],
];

function simulateRead(previousState, snapshot, calls) {
  if (snapshot.loading || snapshot.fetching || snapshot.error) return previousState;
  // O contrato seguro é observacional: o snapshot é exibido, nunca reconciliado por exclusão.
  calls.cacheWrites.push({ kind: "replace-from-query", data: snapshot.data });
  return snapshot.data;
}

for (const [name, snapshot] of scenarios) {
  const calls = { deletes: [], mutableRpcs: [], updates: [], cacheRemovals: [], cacheWrites: [] };
  const result = simulateRead(previous, snapshot, calls);
  assert.equal(calls.deletes.length, 0, `${name}: zero DELETE`);
  assert.equal(calls.mutableRpcs.length, 0, `${name}: zero RPC mutável`);
  assert.equal(calls.updates.length, 0, `${name}: zero marcação de remoção`);
  assert.equal(calls.cacheRemovals.length, 0, `${name}: zero remoção destrutiva do cache`);
  if (!snapshot.loading && !snapshot.fetching && !snapshot.error) {
    assert.deepEqual(result, snapshot.data, `${name}: snapshot parcial deve ser preservado`);
  } else {
    assert.deepEqual(result, previous, `${name}: estado anterior deve sobreviver a estado intermediário/erro`);
  }
}

// Exclusões legítimas continuam isoladas em handlers acionados pela UI.
assert.match(deleteExpense, /from\("expenses"\)\.delete\(\)\.eq\("installment_group_id", groupId\)/u, "exclusão explícita de série de despesa preservada");
assert.match(deleteExpense, /from\("expenses"\)\.delete\(\)\.eq\("id", id\)/u, "exclusão explícita de despesa preservada");
assert.match(deleteIncome, /from\("incomes"\)\.delete\(\)\.eq\("installment_group_id", groupId\)/u, "exclusão explícita de série de receita preservada");
assert.match(deleteIncome, /from\("incomes"\)\.delete\(\)\.eq\("id", id\)/u, "exclusão explícita de receita preservada");
assert.ok(deleteExpense.indexOf("if (error) throw error") < deleteExpense.indexOf("setExpenses((prev) => prev.filter"), "falha de DELETE de despesa preserva cache");
assert.ok(deleteIncome.indexOf("if (error) throw error") < deleteIncome.indexOf("setIncomes((prev) => prev.filter"), "falha de DELETE de receita preserva cache");

for (const [name, source, callback] of [
  ["despesa", expenseListSource, "onDeleteExpense(deleteId)"],
  ["receita", incomeListSource, "onDelete(deleteId)"],
]) {
  assert.match(source, /<AlertDialogCancel>Cancelar<\/AlertDialogCancel>/u, `${name}: cancelamento disponível`);
  assert.ok(source.indexOf(callback) > source.indexOf("<AlertDialogAction"), `${name}: DELETE somente na confirmação`);
  assert.match(source, /Excluir série parcelada\?/u, `${name}: série exige confirmação específica`);
}

const changed = [
  ...lines(git(["diff", "--name-only", "HEAD"])),
  ...lines(git(["ls-files", "--others", "--exclude-standard"])),
].map((path) => path.replaceAll("\\", "/"));
assert.deepEqual(changed.sort(), [
  "docs/audits/post-tools-p1-installment-auto-delete/README.md",
  "package.json",
  "scripts/post-tools-p1-installment-safety-tests.mjs",
  "src/pages/Index.tsx",
].sort(), "somente os quatro arquivos P1 esperados podem mudar");

for (const path of lines(git(["diff", "--name-only", "HEAD", "--", "supabase/migrations"]))) {
  assert.fail(`migration histórica alterada: ${path}`);
}
for (const path of changed) {
  assert.doesNotMatch(path, /(?:^|\/)(?:supabase\/functions\/mcp|src\/lib\/mcp)(?:\/|$)/u, "nenhum arquivo MCP alterado");
  if (/(?:expense|income|transaction|financial|financeir)/iu.test(path)) {
    assert.equal(path, "docs/audits/post-tools-p1-installment-auto-delete/README.md", `código financeiro fora do Index alterado: ${path}`);
  }
}

assert.equal(lines(git(["ls-files", "supabase/migrations/*.sql"])).length, 64, "migration count permanece 64");
console.log(`P1: ${scenarios.length} cenários de leitura, exclusões explícitas e escopo validados.`);
