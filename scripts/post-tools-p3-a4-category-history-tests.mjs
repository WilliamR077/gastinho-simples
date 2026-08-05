import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const importTs = async path => {
  const source = await read(path);
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
};

const { resolveReportCategory } = await importTs("src/utils/report-category-resolver.ts");
const { categoryEditPatch, expenseSelectionForEdit } = await importTs("src/utils/category-edit-preservation.ts");
const { shouldApplyCategoryReferenceResponse } = await importTs("src/types/category-history.ts");
const categories = [
  { id: "active", name: "Mercado atual", icon: "🛒" },
  { id: "archived", name: "Viagem renomeada", icon: "✈️" },
];

// Real unit tests: canonical resolver identity and precedence.
assert.equal(resolveReportCategory({ categoryId: "active", categoryName: "antigo" }, categories).name, "Mercado atual");
assert.equal(resolveReportCategory({ categoryId: "archived", categoryName: "Viagem" }, categories).name, "Viagem renomeada");
const brokenA = resolveReportCategory({ categoryId: "missing-a", categoryName: "Mesmo nome" }, categories);
const brokenB = resolveReportCategory({ categoryId: "missing-b", categoryName: "Mesmo nome" }, categories);
assert.notEqual(brokenA.key, brokenB.key);
assert.equal(brokenA.name, "Mesmo nome");
assert.notEqual(
  resolveReportCategory({ categoryId: "missing-a" }, categories).key,
  resolveReportCategory({ categoryId: "missing-b" }, categories).key,
);
assert.match(resolveReportCategory({ categoryName: "Somente snapshot" }, categories).key, /^snapshot-name:/);
assert.equal(resolveReportCategory({ legacyLabel: "Legado" }, categories).name, "Legado");
assert.equal(resolveReportCategory({}, categories).key, "uncategorized");

// Real unit tests: canonical edit selection and non-destructive patches.
assert.equal(expenseSelectionForEdit("active", "outros", categories), "active");
assert.equal(expenseSelectionForEdit("archived", "viagem", categories), "archived");
assert.equal(expenseSelectionForEdit(null, "viagem_renomeada", categories), "archived");
assert.equal(expenseSelectionForEdit(null, null, categories), null);
assert.deepEqual(categoryEditPatch({
  currentSelection: "archived", nextSelection: "archived", idColumn: "category_id",
}), {});
assert.deepEqual(categoryEditPatch({
  currentSelection: null, nextSelection: null, idColumn: "category_id",
}), {});
assert.deepEqual(categoryEditPatch({
  currentSelection: "active", nextSelection: "archived", idColumn: "income_category_id",
  selectedCategory: categories[1],
}), { income_category_id: "archived", category_name: "Viagem renomeada", category_icon: "✈️" });
assert.equal(shouldApplyCategoryReferenceResponse(2, 2, "category-b", "category-b"), true);
assert.equal(shouldApplyCategoryReferenceResponse(1, 2, "category-a", "category-b"), false);

// Structural SQL tests. PostgreSQL runtime/concurrency smoke remains external.
const operations = await read("supabase/migrations/20260805130000_p3a4_category_history_operations.sql");
for (const required of [
  "system_key text", "system_key = 'other'", "CREATE UNIQUE INDEX",
  "p3a4_category_lock_key", "p3a4_lock_category_scope", "pg_advisory_xact_lock",
  "BEFORE INSERT OR UPDATE OR DELETE ON public.budget_goals",
  "LEGACY_GOAL_REFERENCE_REQUIRES_REVIEW", "SECURITY DEFINER",
  "SET search_path = public, pg_temp", "REVOKE ALL", "FROM PUBLIC, anon",
]) assert.ok(operations.includes(required), `migration missing ${required}`);
assert.ok(!operations.includes("user_id_param"), "category RPCs must not accept arbitrary user IDs");
assert.match(operations, /type = 'category'\s+AND category = p_source_category_id::text/u);
assert.match(operations, /type = 'income_category'\s+AND category = p_source_category_id::text/u);
assert.doesNotMatch(
  operations,
  /UPDATE public\.budget_goals SET category = p_destination_category_id::text[\s\S]{0,300}lower\(btrim\(category\)\)/u,
);

const repairMigration = new URL("../supabase/migrations/20260805131000_repair_caldas_novas_history.sql", import.meta.url);
assert.equal(existsSync(repairMigration), false, "Caldas Novas must not be a normal migration");
const preflight = await read("scripts/maintenance/p3a4-caldas-novas-preflight.sql");
assert.match(preflight, /expense_count = 9 AND total_amount = 279\.90/u);
assert.doesNotMatch(preflight, /\b(?:INSERT|UPDATE|DELETE)\b/iu);

const dialog = await read("src/components/category-history-dialog.tsx");
assert.ok(dialog.includes("counts.total > 0 && !isSystemOther"), "archived sources may be replaced");
assert.ok(dialog.includes("requestIdRef"), "stale reference counts must be discarded");

const detail = await read("src/components/transaction-detail-sheet.tsx");
assert.ok((detail.match(/resolveReportCategory\(/g) ?? []).length >= 2, "income details share canonical precedence");

console.log("P3-A4 unit and structural tests passed");
