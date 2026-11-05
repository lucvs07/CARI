"use client";

import { CariError } from "@/features/cari/CariError";
import "./globals.css";

/** Erro no próprio layout raiz: substitui o documento inteiro (html/body próprios, sem o tema salvo). */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <title>CARI</title>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-4">
          <CariError error={error} retry={retry} />
        </main>
      </body>
    </html>
  );
}
