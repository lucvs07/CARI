import { onlineManager } from "@tanstack/react-query";

/*
 * Sinal fraco: navigator.onLine fica true, mas as requisições falham ou ficam penduradas.
 * Toda requisição do Supabase tem prazo (fetchWithTimeout), e uma falha de rede numa escrita da
 * lista marca o app como offline (goOffline): o TanStack pausa e persiste a fila, e uma sonda leve
 * devolve o "online" quando o Supabase voltar a responder.
 */

/** Prazo de cada requisição ao Supabase (REST, RPC, auth). */
export const FETCH_TIMEOUT_MS = 8_000;
/** Intervalo da sonda enquanto o app está offline por falha de rede. */
export const PROBE_INTERVAL_MS = 5_000;
const PROBE_TIMEOUT_MS = 4_000;

type Fetch = typeof fetch;

function withTimeout(signal: AbortSignal | null | undefined, ms: number): AbortSignal | undefined {
  if (typeof AbortSignal.timeout !== "function") return signal ?? undefined;
  const timeout = AbortSignal.timeout(ms);
  if (!signal) return timeout;
  return typeof AbortSignal.any === "function" ? AbortSignal.any([signal, timeout]) : signal;
}

/** `fetch` com prazo; combina com o signal de quem chamou (cancelamento continua valendo). */
export function createFetchWithTimeout(base: Fetch = (...args) => fetch(...args), ms = FETCH_TIMEOUT_MS): Fetch {
  return (input, init) => {
    const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    return base(input, { ...init, signal: withTimeout(callerSignal, ms) });
  };
}

/** Falha de transporte: a requisição não teve resposta HTTP (sem sinal, abortada, prazo estourado). */
export class NetworkError extends Error {
  constructor(message = "network") {
    super(message);
    this.name = "NetworkError";
  }
}

export function isNetworkError(err: unknown): boolean {
  if (err instanceof NetworkError || err instanceof TypeError) return true;
  const name = (err as { name?: unknown } | null)?.name;
  return name === "NetworkError" || name === "AbortError" || name === "TimeoutError";
}

type SupabaseResult = { error: { message: string; code?: string } | null; status: number };

/**
 * O postgrest-js não lança em falha de rede: devolve `status: 0` e `code: ""`.
 * Erro com resposta (código do PostgREST / status HTTP) é relançado como veio.
 */
export function throwIfError(res: SupabaseResult): void {
  if (!res.error) return;
  if (res.status === 0) throw new NetworkError(res.error.message);
  throw res.error;
}

let probeTimer: ReturnType<typeof setInterval> | undefined;
let probing = false;
let unsubscribe: (() => void) | undefined;

function stopProbe() {
  clearInterval(probeTimer);
  probeTimer = undefined;
  unsubscribe?.();
  unsubscribe = undefined;
}

async function probeOnce(): Promise<void> {
  // Sem rede de verdade quem avisa é o evento "online" do navegador (listener padrão do onlineManager).
  if (probing || onlineManager.isOnline() || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  probing = true;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
      cache: "no-store",
      signal: withTimeout(undefined, PROBE_TIMEOUT_MS),
    });
    if (res.ok) onlineManager.setOnline(true);
  } catch {
    // ainda sem sinal: tenta no próximo intervalo
  } finally {
    probing = false;
  }
}

/**
 * Falha de rede numa escrita da lista: pausa as mutações (o TanStack persiste a fila) e sonda até
 * o Supabase responder. Idempotente; a sonda para sozinha quando o app volta a ficar online.
 */
export function goOffline(): void {
  if (typeof window === "undefined") return;
  onlineManager.setOnline(false);
  if (probeTimer !== undefined) return;
  probeTimer = setInterval(() => void probeOnce(), PROBE_INTERVAL_MS);
  unsubscribe = onlineManager.subscribe((online) => {
    if (online) stopProbe();
  });
}

/** Só para testes. */
export function _resetNetworkForTests(): void {
  stopProbe();
  probing = false;
}
