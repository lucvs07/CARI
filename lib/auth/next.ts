/** Aceita apenas paths relativos do próprio app; qualquer outra coisa vira `/`. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || /[\x00-\x1f\\]/.test(next)) return "/";
  try {
    if (/[\x00-\x1f\\]/.test(decodeURIComponent(next))) return "/";
    const u = new URL(next, "http://x");
    if (u.origin !== "http://x") return "/";
    const out = u.pathname + u.search + u.hash;
    if (out.startsWith("//") || out.startsWith("/\\")) return "/";
    return out;
  } catch {
    return "/";
  }
}
