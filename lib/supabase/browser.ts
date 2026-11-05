import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createFetchWithTimeout } from "@/lib/query/network";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | undefined;

export function getBrowserSupabase(): SupabaseClient<Database> {
  client ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Prazo em toda requisição HTTP (REST, RPC e auth): com sinal fraco uma requisição pendurada não
    // segura a fila da lista nem o lock do refresh de sessão. O Realtime usa WebSocket (fora disto).
    { global: { fetch: createFetchWithTimeout() } },
  );
  return client;
}
