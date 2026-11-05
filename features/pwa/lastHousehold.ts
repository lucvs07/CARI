/** Última casa cuja Lista foi aberta: a tela offline leva de volta para ela (que está no cache do SW). */
const KEY = "cari-last-household";

export function rememberLastHousehold(householdId: string): void {
  try {
    localStorage.setItem(KEY, householdId);
  } catch {
    // storage bloqueado (aba privada): a tela offline cai no link para "/".
  }
}

/** Ao sair da conta: a próxima pessoa não é levada à Lista de outra casa. */
export function forgetLastHousehold(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // storage bloqueado: nada guardado
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
