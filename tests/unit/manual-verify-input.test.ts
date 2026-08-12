import { describe, expect, it } from 'vitest'

import { manualVerifyInputSchema } from '../../src/manual-verify-input'

describe('manualVerifyInputSchema', () => {
  it('normalises the GOC number the operator typed', () => {
    const parsed = manualVerifyInputSchema.parse({ gocNumber: ' d-17909 ' })

    expect(parsed.gocNumber).toBe('D-17909')
  })

  // The route looks a Practitioner up by this value; a typo should come back
  // as a 400 the operator can read, not a silent "no such Practitioner".
  it('rejects anything that is not a GOC registration number', () => {
    for (const gocNumber of ['', '   ', '99000001', 'Jane Smith', '99-1']) {
      const result = manualVerifyInputSchema.safeParse({ gocNumber })
      expect(
        result.success,
        `expected ${JSON.stringify(gocNumber)} to fail`,
      ).toBe(false)
    }
  })

  // Bypassing the 24h suppression cache costs a live scrape, so the operator
  // has to ask for it: an absent flag means "reuse a recent result".
  it('defaults to respecting the suppression cache', () => {
    expect(
      manualVerifyInputSchema.parse({ gocNumber: '99-000001' }).force,
    ).toBe(false)
    expect(
      manualVerifyInputSchema.parse({ gocNumber: '99-000001', force: true })
        .force,
    ).toBe(true)
  })
})
