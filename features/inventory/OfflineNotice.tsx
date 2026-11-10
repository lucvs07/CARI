import { cari } from "@/features/cari/messages";

/** Aviso do estoque sem rede (spec §8: os controles ficam desabilitados com aviso). */
export function InventoryOfflineNotice() {
  return (
    <p role="status" className="rounded-lg bg-surface-container-low px-3 py-2 text-sm ring-1 ring-border">
      {cari.inventoryOffline}
    </p>
  );
}
