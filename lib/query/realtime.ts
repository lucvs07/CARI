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
  return rows.map((r, j) => (j === i ? next : r));
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
