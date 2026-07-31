import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ACCESS_TOKEN } = process.env;

assert.ok(SUPABASE_URL, "Defina SUPABASE_URL.");
assert.ok(SUPABASE_ANON_KEY, "Defina SUPABASE_ANON_KEY.");
assert.ok(SUPABASE_ACCESS_TOKEN, "Defina SUPABASE_ACCESS_TOKEN para um usuário comum.");

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
  global: {
    headers: { Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}` },
  },
});

const { data: userData, error: userError } = await supabase.auth.getUser(
  SUPABASE_ACCESS_TOKEN,
);
assert.ifError(userError);
assert.ok(userData.user, "A sessão deve pertencer a um usuário autenticado.");

const marker = randomUUID().replaceAll("-", "").toUpperCase();
const attemptedName = `G1-C2 negative ${marker.slice(0, 12)}`;
const attemptedInviteCode = marker.slice(12, 18);
const { data: inserted, error: insertError } = await supabase
  .from("shared_groups")
  .insert({
    name: attemptedName,
    description: "Controlled negative permission smoke",
    created_by: userData.user.id,
    invite_code: attemptedInviteCode,
    color: "#6366f1",
  })
  .select("id");

if (!insertError && inserted?.length) {
  const insertedId = inserted[0].id;
  await supabase.from("shared_groups").delete().eq("id", insertedId);
  throw new Error("INSERT direto foi aceito; a linha inesperada recebeu tentativa de limpeza.");
}

assert.ok(insertError, "INSERT direto deve falhar.");
assert.ok(
  insertError.code === "42501" || /permission denied/iu.test(insertError.message),
  `Erro inesperado no INSERT direto: ${insertError.code ?? "sem código"}`,
);

const { count, error: verificationError } = await supabase
  .from("shared_groups")
  .select("id", { count: "exact", head: true })
  .eq("created_by", userData.user.id)
  .eq("name", attemptedName);

assert.ifError(verificationError);
assert.equal(count, 0, "Nenhum grupo pode ter sido criado pela tentativa direta.");
console.log("PASS: INSERT direto negado e nenhuma linha criada.");
