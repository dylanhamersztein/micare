import { describe, expect, it } from 'vitest'

import {
  applyNameMatch,
  mockVerify,
  verificationOutcome,
} from '../../src/verification'
import type { VerificationResult } from '../../src/verification'

describe('verificationOutcome', () => {
  it('maps found-active to verified', () => {
    const result: VerificationResult = {
      kind: 'found-active',
      registrationNumber: '01-123456',
      registrantName: 'Jane Smith',
    }
    expect(verificationOutcome(result)).toBe('verified')
  })

  it('maps not-found to rejected', () => {
    expect(
      verificationOutcome({
        kind: 'not-found',
        registrationNumber: '01-000000',
      }),
    ).toBe('rejected')
  })

  it('maps ambiguous to pending', () => {
    expect(
      verificationOutcome({
        kind: 'ambiguous',
        registrationNumber: '01-123456',
      }),
    ).toBe('pending')
  })

  it('maps error to pending', () => {
    expect(
      verificationOutcome({
        kind: 'error',
        registrationNumber: '01-123456',
        reason: 'timeout',
      }),
    ).toBe('pending')
  })
})

describe('mockVerify', () => {
  it('returns the configured fixture for a known GOC number', () => {
    expect(mockVerify('99-000002', 'Nobody')).toEqual({
      kind: 'not-found',
      registrationNumber: '99-000002',
    })
    expect(mockVerify('99-000003', 'Nobody')).toEqual({
      kind: 'ambiguous',
      registrationNumber: '99-000003',
    })
  })

  it('is deterministic — repeated calls return an equal result', () => {
    expect(mockVerify('99-000003', 'Nobody')).toEqual(
      mockVerify('99-000003', 'Nobody'),
    )
  })

  it('defaults an unknown GOC number to found-active so local dev works', () => {
    const result = mockVerify('42-424242', 'Ada Lovelace')
    expect(result.kind).toBe('found-active')
    expect(result.registrationNumber).toBe('42-424242')
  })

  // Issue #68: with the name check live, a mock register that answers every
  // number with a fixed registrant would reject every local signup. The
  // default fixture therefore holds whatever name it is asked about — a
  // developer signing up locally is the registrant — and one reserved number
  // holds somebody in particular so the mismatch path stays reachable.
  it('holds the submitted name as the registrant for an unreserved number', () => {
    expect(mockVerify('42-424242', 'Ada Lovelace')).toEqual({
      kind: 'found-active',
      registrationNumber: '42-424242',
      registrantName: 'Ada Lovelace',
    })
  })

  it('holds one fixed registrant on 99-000005, so a mismatch can be driven', () => {
    expect(mockVerify('99-000005', 'Somebody Else')).toEqual({
      kind: 'found-active',
      registrationNumber: '99-000005',
      registrantName: 'Ethan Belson',
    })
  })
})

// Issue #68: the register's answer is only half the check. `verify` was given
// the submitted name and never compared it to the name the register holds, so
// anyone could list under any name using a GOC number lifted from the public
// register. `applyNameMatch` is the adjudication half: it takes the register's
// truth and the name the prospect claimed, and downgrades a found-active whose
// registrant is somebody else.
describe('applyNameMatch', () => {
  function registerHolds(registrantName: string): VerificationResult {
    return {
      kind: 'found-active',
      registrationNumber: '01-123456',
      registrantName,
    }
  }

  it('keeps found-active when the submitted name is the registrant name', () => {
    expect(applyNameMatch(registerHolds('Jane Smith'), 'Jane Smith')).toEqual(
      registerHolds('Jane Smith'),
    )
  })

  it('ignores case, padding and repeated spaces', () => {
    expect(
      applyNameMatch(registerHolds('Jane Smith'), '  jane   SMITH '),
    ).toEqual(registerHolds('Jane Smith'))
  })

  it('ignores accents and punctuation, which registers and keyboards disagree on', () => {
    expect(
      applyNameMatch(registerHolds("Siân O'Brien"), 'Sian OBrien'),
    ).toEqual(registerHolds("Siân O'Brien"))
  })

  it('ignores a middle name the register holds and the prospect omitted', () => {
    expect(
      applyNameMatch(registerHolds('Jane Elizabeth Smith'), 'Jane Smith'),
    ).toEqual(registerHolds('Jane Elizabeth Smith'))
  })

  it('ignores a middle name the prospect gave and the register omits', () => {
    expect(
      applyNameMatch(registerHolds('Jane Smith'), 'Jane Elizabeth Smith'),
    ).toEqual(registerHolds('Jane Smith'))
  })

  it('ignores an honorific on either side', () => {
    expect(
      applyNameMatch(registerHolds('Jane Smith'), 'Dr Jane Smith'),
    ).toEqual(registerHolds('Jane Smith'))
    expect(
      applyNameMatch(registerHolds('Mr John Smith'), 'John Smith'),
    ).toEqual(registerHolds('Mr John Smith'))
  })

  it('rejects a different surname on the same registration number', () => {
    expect(applyNameMatch(registerHolds('Jane Smith'), 'Jane Okonkwo')).toEqual(
      {
        kind: 'name-mismatch',
        registrationNumber: '01-123456',
        registrantName: 'Jane Smith',
      },
    )
  })

  it('rejects a different first name on the same registration number', () => {
    expect(applyNameMatch(registerHolds('Jane Smith'), 'Peter Smith')).toEqual({
      kind: 'name-mismatch',
      registrationNumber: '01-123456',
      registrantName: 'Jane Smith',
    })
  })

  it('rejects an empty submitted name rather than waving it through', () => {
    expect(applyNameMatch(registerHolds('Jane Smith'), '   ')).toEqual({
      kind: 'name-mismatch',
      registrationNumber: '01-123456',
      registrantName: 'Jane Smith',
    })
  })

  it('rejects when the register heading gave us no name to match against', () => {
    expect(applyNameMatch(registerHolds(''), 'Jane Smith')).toEqual({
      kind: 'name-mismatch',
      registrationNumber: '01-123456',
      registrantName: '',
    })
  })

  it('leaves every result the register never answered untouched', () => {
    const notFound: VerificationResult = {
      kind: 'not-found',
      registrationNumber: '01-000000',
    }
    const ambiguous: VerificationResult = {
      kind: 'ambiguous',
      registrationNumber: '01-123456',
    }
    const error: VerificationResult = {
      kind: 'error',
      registrationNumber: '01-123456',
      reason: 'timeout',
    }

    expect(applyNameMatch(notFound, 'Jane Smith')).toEqual(notFound)
    expect(applyNameMatch(ambiguous, 'Jane Smith')).toEqual(ambiguous)
    expect(applyNameMatch(error, 'Jane Smith')).toEqual(error)
  })

  it('re-adjudicates a cached name-mismatch for the registrant it belongs to', () => {
    // The 24h suppression cache is keyed on the GOC number alone, so the row
    // one prospect's wrong name produced is the row the real registrant's
    // attempt reads back. Adjudication has to be able to run in both
    // directions or the cache becomes a lockout.
    const cached: VerificationResult = {
      kind: 'name-mismatch',
      registrationNumber: '01-123456',
      registrantName: 'Jane Smith',
    }

    expect(applyNameMatch(cached, 'Jane Smith')).toEqual(
      registerHolds('Jane Smith'),
    )
  })
})

describe('verificationOutcome for a name mismatch', () => {
  it('maps name-mismatch to rejected — the register answered, the name did not match', () => {
    expect(
      verificationOutcome({
        kind: 'name-mismatch',
        registrationNumber: '01-123456',
        registrantName: 'Jane Smith',
      }),
    ).toBe('rejected')
  })
})
