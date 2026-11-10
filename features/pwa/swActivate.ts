import { LISTA_CACHE } from "./cacheNames";

type ActivateEventLike = { waitUntil(promise: Promise<unknown>): void };

/**
 * SW novo ativando = deploy novo: o Serwist apaga do precache os chunks do build anterior, e uma Lista
 * guardada antes apontaria para eles (abriria sem JS, toques mortos). Melhor a tela offline honesta;
 * a próxima visita com sinal guarda a Lista de novo.
 */
export function clearListaOnActivate(event: ActivateEventLike, cacheStorage: Pick<CacheStorage, "delete">): void {
  event.waitUntil(cacheStorage.delete(LISTA_CACHE));
}
