import { describe, expect, it } from 'vitest'

import { formatRevocationEmail } from '../../src/revocation-notice'

describe('formatRevocationEmail', () => {
  it('addresses the practitioner by name and explains the removal', () => {
    const email = formatRevocationEmail({
      fullName: 'Jane Optician',
      refund: { kind: 'refunded', pence: 1933 },
    })
    expect(email.subject).toBe('Your MiCare listing has been removed')
    expect(email.text).toContain('Hi Jane Optician,')
    expect(email.text.toLowerCase()).toContain('general optical council')
  })

  it('quotes the amount actually refunded rather than promising a refund in the abstract', () => {
    const email = formatRevocationEmail({
      fullName: 'Jane Optician',
      refund: { kind: 'refunded', pence: 1933 },
    })
    expect(email.text).toContain('£19.33')
    expect(email.text.toLowerCase()).toContain('unused portion')
  })

  it('pads the pence so a whole-pound refund does not read as £19.3', () => {
    const email = formatRevocationEmail({
      fullName: 'Jane Optician',
      refund: { kind: 'refunded', pence: 1900 },
    })
    expect(email.text).toContain('£19.00')
  })

  it('claims no money when the cancellation left no unused portion', () => {
    const email = formatRevocationEmail({
      fullName: 'Jane Optician',
      refund: { kind: 'nothing-to-refund' },
    })
    expect(email.text.toLowerCase()).toContain('cancelled your subscription')
    expect(email.text.toLowerCase()).toContain('nothing to refund')
    expect(email.text).not.toContain('£')
  })

  it('says the practitioner was not being billed when there was no subscription', () => {
    const email = formatRevocationEmail({
      fullName: 'Jane Optician',
      refund: { kind: 'not-billed' },
    })
    expect(email.text.toLowerCase()).toContain('not being billed')
    expect(email.text).not.toContain('£')
  })
})
