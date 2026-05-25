import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { parseGocRegisterPage } from '../../src/goc-register'

function fixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../fixtures/goc/${name}`, import.meta.url)),
    'utf8',
  )
}

// Aligned with the real saved fixtures (see Prerequisites). found-active.html
// is the Ethan Belson D-17909 registrant detail page; not-found.html mirrors
// the GOC "Sorry no results match your search" UI; malformed-register.html is
// the GOC 404 page (no registrant card, no no-results message).
const FOUND_ACTIVE_NUMBER = 'D-17909'
const FOUND_ACTIVE_NAME = 'Ethan Belson'
const ABSENT_NUMBER = 'ZZ-999999'

describe('parseGocRegisterPage', () => {
  it('returns found-active for a registered registrant', () => {
    const result = parseGocRegisterPage(
      fixture('found-active.html'),
      FOUND_ACTIVE_NUMBER,
    )

    expect(result).toEqual({
      kind: 'found-active',
      registrationNumber: FOUND_ACTIVE_NUMBER,
      registrantName: FOUND_ACTIVE_NAME,
    })
  })

  it('returns not-found for the no-results page', () => {
    const result = parseGocRegisterPage(fixture('not-found.html'), ABSENT_NUMBER)

    expect(result).toEqual({
      kind: 'not-found',
      registrationNumber: ABSENT_NUMBER,
    })
  })

  it('returns not-found when the card shows a different registrant', () => {
    // The fixture is for D-17909; querying with a different number must not
    // mistakenly resolve to "found".
    const result = parseGocRegisterPage(fixture('found-active.html'), ABSENT_NUMBER)

    expect(result).toEqual({
      kind: 'not-found',
      registrationNumber: ABSENT_NUMBER,
    })
  })

  it('returns ambiguous for a page that is neither a card nor a no-results page', () => {
    const result = parseGocRegisterPage(
      fixture('malformed-register.html'),
      FOUND_ACTIVE_NUMBER,
    )

    expect(result).toEqual({
      kind: 'ambiguous',
      registrationNumber: FOUND_ACTIVE_NUMBER,
    })
  })
})
