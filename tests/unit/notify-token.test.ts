import { describe, expect, it } from 'vitest'

import {
  signNotifyToken,
  verifyNotifyToken,
} from '../../src/server/notify-token'

const SECRET = 'unit-test-notify-secret-0123456789abcdef'
const SUBSCRIPTION_ID = '6f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f'

describe('notify-me token', () => {
  it('round-trips the subscription id it was minted for', () => {
    const token = signNotifyToken(SUBSCRIPTION_ID, 'confirm', SECRET)
    expect(verifyNotifyToken(token, 'confirm', SECRET)).toBe(SUBSCRIPTION_ID)
  })

  it('rejects a payload swapped onto someone else’s signature', () => {
    const token = signNotifyToken(SUBSCRIPTION_ID, 'confirm', SECRET)
    const [, sig] = token.split('.')
    const forged = `${Buffer.from('confirm:00000000-0000-0000-0000-000000000000').toString('base64url')}.${sig}`
    expect(verifyNotifyToken(forged, 'confirm', SECRET)).toBeNull()
  })

  it('rejects a token signed with a different secret', () => {
    const token = signNotifyToken(SUBSCRIPTION_ID, 'confirm', SECRET)
    expect(
      verifyNotifyToken(token, 'confirm', 'another-secret-0123456789abcdef'),
    ).toBeNull()
  })

  // An unsubscribe link lands in every email MiCare sends to this address; a
  // confirm link only in the opt-in mail. Scoping the signature to the purpose
  // stops the widely-circulated one from being replayed as the other.
  it('will not accept a token minted for the other purpose', () => {
    const confirmToken = signNotifyToken(SUBSCRIPTION_ID, 'confirm', SECRET)
    const unsubscribeToken = signNotifyToken(
      SUBSCRIPTION_ID,
      'unsubscribe',
      SECRET,
    )

    expect(verifyNotifyToken(confirmToken, 'unsubscribe', SECRET)).toBeNull()
    expect(verifyNotifyToken(unsubscribeToken, 'confirm', SECRET)).toBeNull()
  })

  it('rejects a malformed token', () => {
    expect(verifyNotifyToken('not-a-token', 'confirm', SECRET)).toBeNull()
    expect(verifyNotifyToken('', 'confirm', SECRET)).toBeNull()
    expect(verifyNotifyToken('a.b', 'confirm', SECRET)).toBeNull()
  })
})
