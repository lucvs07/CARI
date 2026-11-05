/** Última unidade/categoria escolhida no aparelho (spec §7.6), compartilhada por Estoque e Lista. */
export const LAST_UNIT = "cari-last-unit";
export const LAST_CATEGORY = "cari-last-category";

export function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Armazenamento indisponível: só perde o pré-preenchimento.
  }
}
