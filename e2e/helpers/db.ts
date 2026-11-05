import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import type { Database } from "../../lib/supabase/database.types";

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const API_URL = "http://127.0.0.1:54321";

let cachedServiceKey: string | undefined;

function serviceRoleKey(): string {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!cachedServiceKey) {
    const out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const match = out.match(/^SERVICE_ROLE_KEY="?([^"\n]+)"?/m);
    if (!match) throw new Error("SERVICE_ROLE_KEY não encontrada em `supabase status -o env`");
    cachedServiceKey = match[1];
  }
  return cachedServiceKey;
}

/** Somente para testes: usa a service role local. Nunca importar do código do app. */
export function adminClient() {
  return createClient<Database>(API_URL, serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Restaura a fixture da casa a1 e apaga as demais casas. */
export async function resetFixture(): Promise<void> {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query("select tests.reset_fixture()");
  } finally {
    await client.end();
  }
}

export const A1 = "00000000-0000-0000-0000-0000000000a1";

/** Estado `checked` da entrada da casa a1 com esse nome (falso se não existir). */
export async function isEntryChecked(name: string): Promise<boolean> {
  const { data, error } = await adminClient()
    .from("shopping_list_entries")
    .select("checked")
    .eq("household_id", A1)
    .eq("name", name)
    .maybeSingle();
  if (error) throw error;
  return data?.checked ?? false;
}

/** Marca entradas direto no banco (preparação de cenários). */
export async function setEntriesChecked(names: string[], checked: boolean): Promise<void> {
  const { error } = await adminClient()
    .from("shopping_list_entries")
    .update({ checked })
    .eq("household_id", A1)
    .in("name", names);
  if (error) throw error;
}
