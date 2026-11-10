"use client";

import { createContext, useContext, useEffect } from "react";

/**
 * Retomar a fila offline só depois de saber de quem ela é: o cache restaurado do IndexedDB pode ser
 * de outra conta (troca de login sem "Sair"). Espera as duas coisas — cache restaurado (Providers)
 * e usuário do servidor (AppShell) — e então roda `onReady(userId)` uma vez por usuário.
 */
export class UserGate {
  #restored = false;
  #userId: string | null = null;
  #ranFor: string | null = null;

  constructor(private readonly onReady: (userId: string) => Promise<void>) {}

  restored(): void {
    this.#restored = true;
    this.#maybeRun();
  }

  setUser(userId: string): void {
    this.#userId = userId;
    this.#maybeRun();
  }

  #maybeRun(): void {
    const userId = this.#userId;
    if (!this.#restored || !userId || this.#ranFor === userId) return;
    this.#ranFor = userId;
    this.onReady(userId).catch((err: unknown) => console.error("cari: falha ao retomar a fila local", err));
  }
}

export const UserGateContext = createContext<UserGate | null>(null);

/** Informa ao gate quem é o usuário do servidor (renderizado dentro do AppShell). */
export function ClaimLocalData({ userId }: { userId: string }) {
  const gate = useContext(UserGateContext);
  useEffect(() => gate?.setUser(userId), [gate, userId]);
  return null;
}
