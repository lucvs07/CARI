"use client";

import { createContext, useContext, type ReactNode } from "react";

const CurrentUserContext = createContext<string | null>(null);

/** Id do usuário logado, vindo do servidor (requireUser no layout): disponível no toque, sem chamar auth. */
export function CurrentUserProvider({ userId, children }: { userId: string; children: ReactNode }) {
  return <CurrentUserContext.Provider value={userId}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUserId(): string | null {
  return useContext(CurrentUserContext);
}
