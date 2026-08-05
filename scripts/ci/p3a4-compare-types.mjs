import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const [generatedPath, versionedPath, diffPath] = process.argv.slice(2);
if (!generatedPath || !versionedPath || !diffPath) {
  console.error("Usage: node p3a4-compare-types.mjs <generated> <versioned> <diff>");
  process.exit(2);
}

const normalizeEol = (value) => value.replace(/\r\n/g, "\n");
const [generated, versioned] = await Promise.all([
  readFile(generatedPath, "utf8"),
  readFile(versionedPath, "utf8"),
]);

if (normalizeEol(generated) === normalizeEol(versioned)) {
  await writeFile(diffPath, "No differences after CRLF/LF normalization.\n", "utf8");
  console.log("Generated Supabase types match the complete versioned file (ignoring only line endings)." );
  process.exit(0);
}

const result = spawnSync(
  "git",
  ["diff", "--no-index", "--ignore-space-at-eol", "--", versionedPath, generatedPath],
  { encoding: "utf8" },
);
const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
await writeFile(diffPath, output || "Type files differ, but git produced no textual diff.\n", "utf8");
process.stdout.write(output);
console.error("Generated Supabase types differ from the complete versioned file.");
process.exit(1);
