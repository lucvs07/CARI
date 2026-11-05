import { cari } from "@/features/cari/messages";

export type CariErrorKey = "houseNameRequired" | "houseNameTooLong" | "inviteInvalid" | "inviteExpired" | "lastOwner" | "alreadyFinished" | "duplicateItem" | "genericError";

// Garante em tempo de compilação que toda chave existe em `cari`.
export type _CariKeysExist = Pick<typeof cari, CariErrorKey>;

export function toCariError(err: unknown): CariErrorKey {
  const e = (err && typeof err === "object" ? err : {}) as { message?: unknown; code?: unknown };
  const message = typeof e.message === "string" ? e.message : "";
  if (message.includes("invite_invalid")) return "inviteInvalid";
  if (message.includes("invite_expired")) return "inviteExpired";
  if (message.includes("last_owner")) return "lastOwner";
  if (message.includes("entry_invalid")) return "alreadyFinished";
  if (e.code === "23505") return "duplicateItem";
  return "genericError";
}

/** Texto da Cari para uma chave de erro (mensagens com parâmetro caem no genérico). */
export function cariErrorMessage(key: CariErrorKey): string {
  return key === "duplicateItem" ? cari.genericError : cari[key];
}
