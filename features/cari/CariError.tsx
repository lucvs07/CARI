"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CariSays } from "./CariSays";
import { cari } from "./messages";

/** Fallback dos error boundaries (spec §8: aviso genérico com "Tentar de novo" e log no console). */
export function CariError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <CariSays
      live
      message={cari.genericError}
      action={
        <Button className="h-11" onClick={() => retry()}>
          {cari.retryAction}
        </Button>
      }
    />
  );
}
