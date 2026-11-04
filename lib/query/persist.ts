import { del } from "idb-keyval";

export const QUERY_CACHE_KEY = "cari-query-cache";

export async function clearPersistedCache(): Promise<void> {
  await del(QUERY_CACHE_KEY);
}
