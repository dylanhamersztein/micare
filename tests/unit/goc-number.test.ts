import { describe, expect, it } from 'vitest'

import {
  GOC_NUMBER_ERROR,
  GOC_NUMBER_HELP,
  gocNumberSchema,
} from '../../src/goc-number'

// The register does not have one fixed shape — `01-123456` and `D-17909` are
// both real — so any copy that shows the Practitioner an example is making a
// claim about what src/goc-number.ts accepts. These tests hold the copy to
// that claim: every example it prints is parsed, and both prefix shapes are
// shown, so nobody can quietly narrow the help text to the digit form and
// leave a dispensing optician believing their own number is malformed.

/** Every registration-number-shaped token a piece of copy shows the reader. */
function examplesIn(copy: string): Array<string> {
  return [...copy.matchAll(/\b[0-9A-Z]{1,2}-\d+\b/g)].map(([token]) => token)
}

describe.each([
  ['the help text', GOC_NUMBER_HELP],
  ['the error copy', GOC_NUMBER_ERROR],
])('%s', (_name, copy) => {
  it('shows at least one example', () => {
    expect(examplesIn(copy).length).toBeGreaterThan(0)
  })

  it('shows every example as a number the schema accepts', () => {
    for (const example of examplesIn(copy)) {
      expect(gocNumberSchema.safeParse(example).success).toBe(true)
    }
  })

  it('shows both prefix shapes the register uses, digits and letters', () => {
    const prefixes = examplesIn(copy).map((example) => example.split('-')[0])

    expect(prefixes.some((prefix) => /^\d{2}$/.test(prefix))).toBe(true)
    expect(prefixes.some((prefix) => /^[A-Z]{1,2}$/.test(prefix))).toBe(true)
  })
})

describe('gocNumberSchema', () => {
  it('rejects a malformed number with the same words the help text uses', () => {
    const result = gocNumberSchema.safeParse('not-a-goc-number')

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(GOC_NUMBER_ERROR)
  })

  it('accepts the shortest and longest digit runs the register uses', () => {
    expect(gocNumberSchema.safeParse('01-1234').success).toBe(true)
    expect(gocNumberSchema.safeParse('01-123456').success).toBe(true)
    expect(gocNumberSchema.safeParse('01-123').success).toBe(false)
  })
})
