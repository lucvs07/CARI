/** Última casa cuja Lista foi aberta: a tela offline leva de volta para ela (que está no cache do SW). */
const KEY = "cari-last-household";

export function rememberLastHousehold(householdId: string): void {
  try {
    localStorage.setItem(KEY, householdId);
  } catch {
    // storage bloqueado (aba privada): a tela offline cai no link para "/".
  }
}

export function lastListaHref(): string {
  try {
    const id = localStorage.getItem(KEY);
    return id ? `/${id}/lista` : "/";
  } catch {
    return "/";
  }
}
