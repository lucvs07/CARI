export const CATEGORIES = [
  'hortifruti',
  'carnes',
  'laticinios',
  'padaria',
  'mercearia',
  'bebidas',
  'congelados',
  'limpeza',
  'higiene',
  'outros',
] as const

export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  hortifruti: 'Hortifrúti',
  carnes: 'Carnes',
  laticinios: 'Laticínios',
  padaria: 'Padaria',
  mercearia: 'Mercearia',
  bebidas: 'Bebidas',
  congelados: 'Congelados',
  limpeza: 'Limpeza',
  higiene: 'Higiene',
  outros: 'Outros',
}
