"use client";

import { useEffect } from "react";

/**
 * Marca `<html data-hydrated="true">` quando a tela que o renderiza hidrata. Fica dentro das telas
 * (não na raiz): com cacheComponents o shell estático hidrata antes do segmento dinâmico da página.
 * Os E2E esperam por ele antes de tocar.
 */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return null;
}
