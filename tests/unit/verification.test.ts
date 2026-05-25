import { describe, expect, it } from 'vitest'

import { mockVerify, verificationOutcome } from '../../src/verification'
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

describe('mockVerify', () => {
  it('returns the configured fixture for a known GOC number', () => {
    expect(mockVerify('99-000001')).toEqual({
      kind: 'found-active',
      registrationNumber: '99-000001',
      registrantName: 'Mock Verified Optician',
    })
    expect(mockVerify('99-000002')).toEqual({
      kind: 'not-found',
      registrationNumber: '99-000002',
    })
    expect(mockVerify('99-000003')).toEqual({
      kind: 'ambiguous',
      registrationNumber: '99-000003',
    })
  })

  it('is deterministic — repeated calls return an equal result', () => {
    expect(mockVerify('99-000003')).toEqual(mockVerify('99-000003'))
  })

  it('defaults an unknown GOC number to found-active so local dev works', () => {
    const result = mockVerify('42-424242')
    expect(result.kind).toBe('found-active')
    expect(result.registrationNumber).toBe('42-424242')
  })
})
