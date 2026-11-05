import { isListWriteKey } from "@/features/shopping/model";

export type RealtimeEvent<T> = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Partial<T>;
  old: Partial<T>;
};

/** Aplica um evento do Supabase Realtime a uma lista em cache (idempotente). */
export function applyRealtimeEvent<T extends { id: string }>(
  rows: T[] | undefined,
  e: RealtimeEvent<T>,
): T[] | undefined {
  if (!rows) return rows;
  if (e.eventType === "DELETE") {
    const id = e.old.id;
    return id === undefined ? rows : rows.filter((r) => r.id !== id);
  }
  const next = e.new as T;
  if (next.id === undefined) return rows;
  const i = rows.findIndex((r) => r.id === next.id);
  if (i === -1) return [...rows, next];
  // Eco atrasado de uma escrita anterior (chega depois do refetch que já trouxe uma mais nova): ignora.
  if (isOlder(next, rows[i])) return rows;
  return rows.map((r, j) => (j === i ? next : r));
}

/** `updated_at` (trigger no banco) de `a` é anterior ao de `b`. Sem o campo em algum dos dois, não decide. */
function isOlder(a: object, b: object): boolean {
  const ta = Date.parse(String((a as { updated_at?: unknown }).updated_at ?? ""));
  const tb = Date.parse(String((b as { updated_at?: unknown }).updated_at ?? ""));
  return Number.isFinite(ta) && Number.isFinite(tb) && ta < tb;
}

export type PendingMutation = { mutationKey?: readonly unknown[]; variables?: unknown };

/**
 * Evento do Realtime para o cache [key, householdId] é ignorado enquanto houver mutação pendente
 * dessa casa com mutationKey[0] === key: o eco da própria escrita sobrescreveria o estado otimista.
 * A invalidação após a última mutação reconcilia com o servidor.
 */
export function shouldSkipRealtime(pending: PendingMutation[], key: string, householdId: string): boolean {
  return pending.some(
    (m) =>
      m.mutationKey?.[0] === key &&
      (m.variables as { householdId?: unknown } | undefined)?.householdId === householdId,
  );
}

/**
 * Caches buscados de novo quando o canal reconecta. A lista fica de fora enquanto houver escrita da
 * lista na fila (como no settle): o refetch traria o servidor sem as marcações ainda não enviadas.
 */
export function keysToRefetchOnReconnect(pending: PendingMutation[]): ("items" | "list")[] {
  const listBusy = pending.some((m) => isListWriteKey(m.mutationKey));
  return listBusy ? ["items"] : ["items", "list"];
}
