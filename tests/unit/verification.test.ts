import { describe, expect, it } from 'vitest'

import { verificationOutcome } from '../../src/verification'
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
      verificationOutcome({ kind: 'not-found', registrationNumber: '01-000000' }),
    ).toBe('rejected')
  })

  it('maps ambiguous to pending', () => {
    expect(
      verificationOutcome({ kind: 'ambiguous', registrationNumber: '01-123456' }),
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
