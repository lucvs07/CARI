import type { Page } from "@playwright/test";

/**
 * Resolve quando o canal Realtime da casa confirma a assinatura do postgres_changes.
 * Registre antes do `goto`: evento enviado antes do join se perde (não há refetch em 30 s).
 */
export function waitForRealtimeReady(page: Page, timeout = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Realtime não assinou a tempo")), timeout);
    page.on("websocket", (ws) => {
      ws.on("framereceived", ({ payload }) => {
        const text = typeof payload === "string" ? payload : payload.toString("utf8");
        if (text.includes("household:") && text.includes("Subscribed to PostgreSQL")) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
  });
}
