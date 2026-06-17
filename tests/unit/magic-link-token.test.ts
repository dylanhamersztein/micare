import { describe, expect, it } from 'vitest'

import {
  signMockToken,
  verifyMockToken,
} from '../../src/server/magic-link-token'

const SECRET = 'unit-test-secret-not-secret-0123456789abcd'
const NOW = 1_750_000_000_000

describe('mock magic-link token', () => {
  it('round-trips an email within its expiry window', () => {
    const token = signMockToken('jane@example.co.uk', NOW + 60_000, SECRET)
    expect(verifyMockToken(token, SECRET, NOW)).toBe('jane@example.co.uk')
  })

  it('rejects an expired token', () => {
    const token = signMockToken('jane@example.co.uk', NOW - 1, SECRET)
    expect(verifyMockToken(token, SECRET, NOW)).toBeNull()
  })

  it('rejects a token signed with a different secret', () => {
    const token = signMockToken('jane@example.co.uk', NOW + 60_000, SECRET)
    expect(
      verifyMockToken(token, 'a-different-secret-0123456789abcdef', NOW),
    ).toBeNull()
  })

  it('rejects a tampered payload', () => {
    const token = signMockToken('jane@example.co.uk', NOW + 60_000, SECRET)
    const [, sig] = token.split('.')
    const forged = `${Buffer.from('mallory@example.co.uk:' + (NOW + 60_000)).toString('base64url')}.${sig}`
    expect(verifyMockToken(forged, SECRET, NOW)).toBeNull()
  })

  it('rejects a malformed token', () => {
    expect(verifyMockToken('not-a-token', SECRET, NOW)).toBeNull()
    expect(verifyMockToken('', SECRET, NOW)).toBeNull()
  })
})
