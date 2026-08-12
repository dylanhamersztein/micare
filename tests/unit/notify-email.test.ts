import { describe, expect, it } from 'vitest'

import { formatConfirmationEmail } from '../../src/notify-email'

describe('formatConfirmationEmail', () => {
  const body = formatConfirmationEmail({
    postcode: 'EC2V 6AA',
    confirmUrl: 'https://micare.co.uk/notify-me/confirm?token=abc',
    unsubscribeUrl: 'https://micare.co.uk/notify-me/unsubscribe?token=xyz',
  })

  it('tells the reader which postcode they asked about', () => {
    expect(body).toContain('EC2V 6AA')
  })

  it('carries both links, so an unwanted subscription needs no reply', () => {
    expect(body).toContain('https://micare.co.uk/notify-me/confirm?token=abc')
    expect(body).toContain(
      'https://micare.co.uk/notify-me/unsubscribe?token=xyz',
    )
  })

  // Double opt-in: someone whose address was typed in by a stranger should be
  // able to do nothing at all and stay off the list.
  it('says that ignoring the email is enough', () => {
    expect(body).toMatch(/ignore this email/i)
  })
})
