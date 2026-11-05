import { cari } from "@/features/cari/messages";

/** Esqueleto leve enquanto a tela da casa carrega do servidor (loading.tsx). */
export function ScreenSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">{cari.loading}</span>
      <div aria-hidden className="h-11 animate-pulse rounded-lg bg-surface-container-low" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden className="h-12 animate-pulse rounded-lg bg-surface-container-low" />
      ))}
    </div>
  );
}
