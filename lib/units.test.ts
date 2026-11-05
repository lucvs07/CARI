import { expect, test } from 'vitest'
import { defaultPurchaseQuantity, formatQuantity, parseQuantity, stepFor, stepQuantity } from './units'

test('stepFor', () => {
  expect(stepFor('un')).toBe(1); expect(stepFor('kg')).toBe(0.5); expect(stepFor('L')).toBe(0.5)
  expect(stepFor('g')).toBe(100); expect(stepFor('ml')).toBe(100)
})
test('stepQuantity limita em 0', () => { expect(stepQuantity(0.3, 'kg', -1)).toBe(0) })
test('stepQuantity sem deriva de ponto flutuante', () => {
  let q = 1.5; for (let i = 0; i < 3; i++) q = stepQuantity(q, 'kg', -1)
  expect(q).toBe(0)
  expect(stepQuantity(0.1 + 0.2, 'un', 1)).toBe(1.3)
})
test('parseQuantity aceita vírgula', () => {
  expect(parseQuantity('1,5')).toBe(1.5); expect(parseQuantity('2.25')).toBe(2.25)
  expect(parseQuantity(' 3 ')).toBe(3); expect(parseQuantity('')).toBeNull()
  expect(parseQuantity('abc')).toBeNull(); expect(parseQuantity('-1')).toBeNull()
})
test('formatQuantity pt-BR', () => {
  expect(formatQuantity(1.5, 'kg')).toBe('1,5 kg'); expect(formatQuantity(2, 'un')).toBe('2 un')
})
test('defaultPurchaseQuantity', () => {
  expect(defaultPurchaseQuantity(null, 'g')).toBe(100); expect(defaultPurchaseQuantity(3, 'un')).toBe(3)
})
