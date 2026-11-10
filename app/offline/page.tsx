import type { Metadata } from "next";
import { CariSays } from "@/features/cari/CariSays";
import { cari } from "@/features/cari/messages";
import { OpenListaLink } from "@/features/pwa/OpenListaLink";

export const metadata: Metadata = { title: "Sem sinal · CARI" };

/** Fallback do SW para documentos sem rede e sem cache (precacheado no build). */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-4">
      <CariSays message={cari.offlineNoCache} action={<OpenListaLink />} />
    </main>
  );
}
