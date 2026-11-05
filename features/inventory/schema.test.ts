import { expect, test } from 'vitest'
import { cari } from '@/features/cari/messages'
import { itemInputSchema } from './schema'

const base = { quantity: '1', unit: 'un', category: 'outros' }

test('rejeita nome vazio/longo, aceita vírgula', () => {
  expect(itemInputSchema.safeParse({ name: '   ', quantity: '1', unit: 'un', category: 'outros' }).success).toBe(false)
  expect(itemInputSchema.safeParse({ name: 'a'.repeat(81), quantity: '1', unit: 'un', category: 'outros' }).success).toBe(false)
  expect(itemInputSchema.parse({ name: ' Arroz ', quantity: '1,5', unit: 'kg', category: 'mercearia' })).toMatchObject({ name: 'Arroz', quantity: 1.5 })
})

test('mensagens vêm de cari', () => {
  const empty = itemInputSchema.safeParse({ ...base, name: ' ' })
  expect(empty.success ? [] : empty.error.issues.map((i) => i.message)).toContain(cari.itemNameRequired)
  const long = itemInputSchema.safeParse({ ...base, name: 'a'.repeat(81) })
  expect(long.success ? [] : long.error.issues.map((i) => i.message)).toContain(cari.itemNameTooLong)
  const bad = itemInputSchema.safeParse({ ...base, name: 'x', quantity: 'abc' })
  expect(bad.success ? [] : bad.error.issues.map((i) => i.message)).toContain(cari.quantityInvalid)
})

test('quantidade: aceita 0, arredonda a 3 casas, limita a 9999999.999', () => {
  expect(itemInputSchema.parse({ ...base, name: 'x', quantity: '0' }).quantity).toBe(0)
  expect(itemInputSchema.parse({ ...base, name: 'x', quantity: '1,23456' }).quantity).toBe(1.235)
  expect(itemInputSchema.parse({ ...base, name: 'x', quantity: '9999999,999' }).quantity).toBe(9999999.999)
  const big = itemInputSchema.safeParse({ ...base, name: 'x', quantity: '10000000' })
  expect(big.success).toBe(false)
  expect(big.success ? [] : big.error.issues.map((i) => i.message)).toContain(cari.quantityTooLarge)
  expect(itemInputSchema.safeParse({ ...base, name: 'x', quantity: '9999999,9996' }).success).toBe(false)
})

test('rejeita unidade e categoria inválidas', () => {
  expect(itemInputSchema.safeParse({ ...base, name: 'x', unit: 'lb' }).success).toBe(false)
  expect(itemInputSchema.safeParse({ ...base, name: 'x', category: 'foo' }).success).toBe(false)
})
