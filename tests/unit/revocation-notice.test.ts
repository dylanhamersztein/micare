import { describe, expect, it } from 'vitest'

import { formatRevocationEmail } from '../../src/revocation-notice'

describe('formatRevocationEmail', () => {
  it('addresses the practitioner by name and explains the removal', () => {
    const email = formatRevocationEmail({
      fullName: 'Jane Optician',
      refunded: true,
    })
    expect(email.subject).toBe('Your MiCare listing has been removed')
    expect(email.text).toContain('Hi Jane Optician,')
    expect(email.text.toLowerCase()).toContain('general optical council')
  })

  it('promises a refund when refunded is true', () => {
    const email = formatRevocationEmail({
      fullName: 'Jane Optician',
      refunded: true,
    })
    expect(email.text.toLowerCase()).toContain('refunded the unused portion')
  })

  it('says the practitioner was not being billed when refunded is false', () => {
    const email = formatRevocationEmail({
      fullName: 'Jane Optician',
      refunded: false,
    })
    expect(email.text.toLowerCase()).toContain('not being billed')
    expect(email.text.toLowerCase()).not.toContain('refunded the unused portion')
  })
})
