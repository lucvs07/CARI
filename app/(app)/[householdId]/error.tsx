"use client";

import { CariError } from "@/features/cari/CariError";

/** Erro numa tela da casa: o shell (abas, menu) continua; `retry` busca o segmento de novo. */
export default function HouseholdError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="py-8">
      <CariError error={error} retry={retry} />
    </div>
  );
}
