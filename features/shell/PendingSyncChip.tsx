"use client";

import { useEffect, useRef } from "react";
import { useMutationState } from "@tanstack/react-query";
import { CloudOffIcon } from "lucide-react";
import { toast } from "sonner";
import { cari } from "@/features/cari/messages";
import { countPausedListWrites } from "@/features/shopping/model";
import { useOnlineStatus } from "@/lib/query/useOnlineStatus";

/** "n alterações aguardando sinal": escritas da lista pausadas sem rede; some quando a fila sincroniza. */
export function PendingSyncChip() {
  const online = useOnlineStatus();
  const pending = useMutationState({
    filters: { status: "pending" },
    select: (m) => ({ mutationKey: m.options.mutationKey, isPaused: m.state.isPaused }),
  });
  // Online, "pausada" só significa esperando a vez no scope da lista (transitório).
  const n = online ? 0 : countPausedListWrites(pending);
  const announced = useRef(false);

  useEffect(() => {
    if (online) {
      announced.current = false;
    } else if (n > 0 && !announced.current) {
      announced.current = true;
      toast(cari.offlineQueued);
    }
  }, [online, n]);

  if (n === 0) return null;
  return (
    <p
      role="status"
      className="flex items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1 text-xs font-medium ring-1 ring-border"
    >
      <CloudOffIcon className="size-3.5" aria-hidden />
      {cari.pendingSync(n)}
    </p>
  );
}
