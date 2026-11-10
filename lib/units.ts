export type Unit = 'kg' | 'g' | 'L' | 'ml' | 'un'

export const UNITS: readonly Unit[] = ['kg', 'g', 'L', 'ml', 'un']

const STEPS: Record<Unit, number> = { kg: 0.5, g: 100, L: 0.5, ml: 100, un: 1 }

export function stepFor(unit: Unit): number {
  return STEPS[unit]
}

function round3(x: number): number {
  const r = Math.round(x * 1000) / 1000
  return Object.is(r, -0) ? 0 : r
}

export function stepQuantity(q: number, unit: Unit, dir: 1 | -1): number {
  return Math.max(0, round3(q + dir * stepFor(unit)))
}

const NUMBER_PATTERN = /^(\d+\.?\d*|\.\d+)$/

export function parseQuantity(input: string): number | null {
  const normalized = input.trim().replace(',', '.')
  if (!NUMBER_PATTERN.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

const PT_BR_NUMBER = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })

export function formatQuantity(q: number, unit: Unit): string {
  return `${PT_BR_NUMBER.format(q)} ${unit}`
}

export function defaultPurchaseQuantity(desired: number | null, unit: Unit): number {
  return desired ?? stepFor(unit)
}
