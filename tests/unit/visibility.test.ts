import { describe, expect, it } from 'vitest'

import { hasMinFields, isVisible } from '../../src/visibility'
import type {
  SubscriptionStatus,
  VerificationStatus,
} from '../../src/visibility'

const VERIFICATION_STATUSES: ReadonlyArray<VerificationStatus> = [
  'pending',
  'verified',
  'rejected',
  'revoked',
]

const SUBSCRIPTION_STATUSES: ReadonlyArray<SubscriptionStatus> = [
  'incomplete',
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'canceled',
]

const VISIBLE_SUBSCRIPTION_STATUSES = new Set<SubscriptionStatus>([
  'active',
  'trialing',
  'past_due',
])

describe('isVisible', () => {
  for (const verificationStatus of VERIFICATION_STATUSES) {
    for (const subscriptionStatus of SUBSCRIPTION_STATUSES) {
      for (const minFieldsFilled of [true, false] as const) {
        const expected =
          verificationStatus === 'verified' &&
          VISIBLE_SUBSCRIPTION_STATUSES.has(subscriptionStatus) &&
          minFieldsFilled

        it(`returns ${expected} for ${verificationStatus} / ${subscriptionStatus} / minFieldsFilled=${minFieldsFilled}`, () => {
          expect(
            isVisible({
              verificationStatus,
              subscriptionStatus,
              minFieldsFilled,
            }),
          ).toBe(expected)
        })
      }
    }
  }

  it('is exhaustive: covers 4 × 6 × 2 = 48 combinations', () => {
    expect(
      VERIFICATION_STATUSES.length * SUBSCRIPTION_STATUSES.length * 2,
    ).toBe(48)
  })
})

describe('hasMinFields', () => {
  const complete = {
    fullName: 'Jane Smith',
    practiceName: 'Smith Optical',
    practiceAddressLine1: '12 Cheapside',
    practicePostcode: 'EC2V 6AA',
    bookingLinkUrl: 'https://example.test/book',
  }

  it('is true when every required field is present', () => {
    expect(hasMinFields(complete)).toBe(true)
  })

  it('is false when any required field is null', () => {
    expect(hasMinFields({ ...complete, practiceName: null })).toBe(false)
    expect(hasMinFields({ ...complete, bookingLinkUrl: null })).toBe(false)
  })

  it('is false when a required field is an empty string', () => {
    expect(hasMinFields({ ...complete, practicePostcode: '' })).toBe(false)
  })
})
