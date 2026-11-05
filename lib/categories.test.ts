import { expect, test } from 'vitest'
import { CATEGORIES, CATEGORY_LABELS } from './categories'

test('ordem e rótulos', () => {
  expect(CATEGORIES[0]).toBe('hortifruti'); expect(CATEGORIES.at(-1)).toBe('outros')
  expect(CATEGORY_LABELS.laticinios).toBe('Laticínios')
})
