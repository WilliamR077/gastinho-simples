import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const bundlePath = new URL("../supabase/functions/mcp/index.ts", import.meta.url);
const source = await readFile(bundlePath, "utf8");

const forbidden = [
  { name: "npm drive path", pattern: /npm:[A-Za-z]:/u },
  {
    name: "Windows absolute path",
    pattern: /(?:^|["'`(=\s])[A-Za-z]:[\\/]/mu,
  },
  { name: "macOS user path", pattern: /\/Users\//u },
  {
    name: "absolute MCP source path",
    pattern:
      /(?:[A-Za-z]:[\\/][^\n"'`]*|\/(?:Users|home|workspace|workspaces|root|tmp)\/[^\n"'`]*)src[\\/]lib[\\/]mcp/iu,
  },
  {
    name: "unbundled local import",
    pattern:
      /(?:\bfrom\s+["']|\bimport\s*(?:\(\s*)?["'])(?:\.\.?[\\/]|file:|[A-Za-z]:)/u,
  },
  {
    name: "unresolved @/ alias",
    pattern:
      /(?:\bfrom\s*["']@\/|\bimport\s*(?:\(\s*)?["']@\/|npm:@\/)/u,
  },
];

for (const check of forbidden) {
  assert.equal(
    check.pattern.test(source),
    false,
    `Bundle MCP inválido: encontrado ${check.name}.`,
  );
}

assert.match(source, /name:\s*"search_transactions"/u);
assert.match(source, /name:\s*"get_spending_breakdown"/u);
assert.match(source, /name:\s*"compare_periods"/u);
assert.match(source, /name:\s*"list_cards"/u);
assert.match(source, /name:\s*"get_card_installments"/u);
assert.match(source, /name:\s*"get_card_summary"/u);
assert.match(source, /name:\s*"list_recurring_transactions"/u);
assert.match(source, /name:\s*"get_recurring_forecast"/u);
assert.match(source, /name:\s*"list_goals"/u);
assert.match(source, /name:\s*"get_goal_progress"/u);
assert.match(source, /name:\s*"get_category_usage"/u);
assert.match(source, /name:\s*"get_cashflow_series"/u);
assert.match(source, /name:\s*"get_cashflow_projection"/u);
assert.match(source, /name:\s*"update_expense"/u);
assert.match(source, /name:\s*"update_income"/u);
assert.match(source, /name:\s*"delete_expense"/u);
assert.match(source, /name:\s*"delete_income"/u);
assert.match(source, /name:\s*"create_recurring_expense"/u);
assert.match(source, /name:\s*"create_recurring_income"/u);
assert.match(source, /name:\s*"update_recurring_expense"/u);
assert.match(source, /name:\s*"update_recurring_income"/u);
assert.match(source, /name:\s*"delete_recurring_expense"/u);
assert.match(source, /name:\s*"delete_recurring_income"/u);
assert.match(source, /Deno\.serve/u);

console.log("Bundle MCP autocontido e sem caminhos absolutos.");
