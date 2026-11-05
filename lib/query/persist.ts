import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { del, get, set } from "idb-keyval";

export const QUERY_CACHE_KEY = "cari-query-cache";

const isBrowser = typeof window !== "undefined";

/** No SSR não toca o IndexedDB (storage indefinido → persister inerte). */
export const persister = createAsyncStoragePersister({
  key: QUERY_CACHE_KEY,
  storage: isBrowser
    ? {
        getItem: (k) => get<string>(k).then((v) => v ?? null),
        setItem: (k, v) => set(k, v),
        removeItem: (k) => del(k),
      }
    : undefined,
});

export async function clearPersistedCache(): Promise<void> {
  await del(QUERY_CACHE_KEY);
}
