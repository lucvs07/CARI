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
