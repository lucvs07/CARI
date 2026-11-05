"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { lastListaHref } from "./lastHousehold";

const noop = () => () => {};

/** Link comum (navegação completa): o SW responde a Lista do cache mesmo sem sinal. */
export function OpenListaLink() {
  const href = useSyncExternalStore(noop, lastListaHref, () => "/");
  return (
    <Button asChild className="h-11">
      <a href={href}>Abrir a Lista</a>
    </Button>
  );
}
