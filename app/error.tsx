"use client";

import { CariError } from "@/features/cari/CariError";

/** Erro fora das telas da casa (ex.: "/" sem conseguir ler as casas), dentro do layout raiz. */
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-4">
      <CariError error={error} retry={retry} />
    </main>
  );
}
