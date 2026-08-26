import { describe, expect, it } from 'vitest'

import {
  SUBSCRIPTION_NOTE,
  SUBSCRIPTION_WORD,
} from '../../src/subscription-status'
import { isVisible } from '../../src/visibility'

import type { SubscriptionStatus } from '../../src/visibility'

const STATUSES: ReadonlyArray<SubscriptionStatus> = [
  'incomplete',
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'canceled',
]

/** The claim "your listing is hidden", however the note phrases it. */
const CLAIMS_HIDDEN = /\b(hidden|not published)\b/

/** Whether ADR-0004 actually hides a verified, fully-filled listing. */
function hides(status: SubscriptionStatus): boolean {
  return !isVisible({
    verificationStatus: 'verified',
    subscriptionStatus: status,
    minFieldsFilled: true,
  })
}

describe('the six subscription states', () => {
  for (const status of STATUSES) {
    it(`gives ${status} a word and a sentence of its own`, () => {
      expect(SUBSCRIPTION_WORD[status]).toBeTruthy()
      expect(SUBSCRIPTION_NOTE[status]).toBeTruthy()
    })

    // The dashboard is where a Practitioner learns whether they are listed.
    // A note that claims a hidden listing where ADR-0004 keeps it visible —
    // or the reverse — is the one lie this screen must not tell.
    it(`says ${status} hides the listing only when it does`, () => {
      expect(CLAIMS_HIDDEN.test(SUBSCRIPTION_NOTE[status])).toBe(hides(status))
    })
  }
})

describe('past_due', () => {
  it('reads as a retry rather than an outage', () => {
    expect(SUBSCRIPTION_NOTE.past_due).toMatch(/retry|retrying/i)
    expect(SUBSCRIPTION_NOTE.past_due).toContain('does not hide your listing')
  })
})

describe('unpaid and canceled', () => {
  it('are told apart in words, not only in colour', () => {
    expect(SUBSCRIPTION_WORD.unpaid).not.toBe(SUBSCRIPTION_WORD.canceled)
    expect(SUBSCRIPTION_NOTE.unpaid).not.toBe(SUBSCRIPTION_NOTE.canceled)
  })

  it('both promise the profile survives, because it does', () => {
    expect(SUBSCRIPTION_NOTE.unpaid).toMatch(/profile is kept/)
    expect(SUBSCRIPTION_NOTE.canceled).toMatch(/profile is kept/)
  })
})
