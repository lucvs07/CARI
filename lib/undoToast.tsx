import { toast } from "sonner";
import { cari } from "@/features/cari/messages";

/** Aviso com "Desfazer" (spec §7): 6 s na tela. */
export const UNDO_TOAST_MS = 6_000;

/**
 * O sonner não aceita `role` no toast: o texto vai num `role="status"` próprio, para o leitor de tela
 * anunciar o que aconteceu (e que dá para desfazer) sem roubar o foco.
 */
export function undoToast(message: string, onUndo: () => void) {
  return toast(<span role="status">{message}</span>, {
    duration: UNDO_TOAST_MS,
    action: { label: cari.undoAction, onClick: onUndo },
  });
}
