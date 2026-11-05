/** Toda fala da Cari vive aqui (spec §9, guia de voz). */
export const cari = {
  welcome: "Oi, eu sou a Cari! Vamos criar sua casa?",
  emptyInventory: "Sua despensa está vazia. Me conta o que tem aí?",
  emptyList: "Nada para comprar 🎉",
  recipesSoon: "Em breve vou sugerir receitas com o que você tem em casa.",
  finished: (n: number) =>
    n === 1 ? "Prontinho! Guardei 1 item no estoque." : `Prontinho! Guardei ${n} itens no estoque.`,
  inviteExpired: "Esse convite expirou. Pede um link novo pra quem te chamou?",
  inviteInvalid: "Não encontrei esse convite. Pede um link novo pra quem te chamou?",
  offlineQueued: "Sem sinal por aqui — guardo suas marcações e envio quando voltar.",
  finishNeedsNetwork: "Precisa de internet para guardar no estoque",
  alreadyFinished: "Alguém da casa já guardou essa compra.",
  lastOwner: "Antes de sair, passe a casa para outra pessoa (torne alguém dono).",
  genericError: "Algo deu errado. Tenta de novo?",
  magicLinkSent: "Te mandei um link! Confere seu e-mail.",
  movedToList: (name: string) => `${name} foi para a lista`,
  removed: "Removido",
  pendingSync: (n: number) =>
    n === 1 ? "1 alteração aguardando sinal" : `${n} alterações aguardando sinal`,
} as const;
