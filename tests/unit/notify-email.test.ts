import { describe, expect, it } from 'vitest'

import {
  formatConfirmationEmail,
  formatNewPractitionerEmail,
} from '../../src/notify-email'

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

describe('formatNewPractitionerEmail', () => {
  const email = formatNewPractitionerEmail({
    fullName: 'Nadia Okafor',
    practiceName: 'Moorgate Eyecare',
    practiceTown: 'London',
    postcode: 'EC2V 6AA',
    profileUrl: 'https://micare.co.uk/p/abc12345/nadia-okafor-moorgate-eyecare',
    unsubscribeUrl: 'https://micare.co.uk/notify-me/unsubscribe?token=xyz',
  })

  // The whole point of the subscription: a link to the Practitioner who just
  // became visible near the postcode the consumer asked about.
  it('links the new profile and names who it belongs to', () => {
    expect(email.text).toContain(
      'https://micare.co.uk/p/abc12345/nadia-okafor-moorgate-eyecare',
    )
    expect(email.text).toContain('Nadia Okafor')
    expect(email.text).toContain('Moorgate Eyecare')
  })

  it('reminds the reader which postcode they are watching', () => {
    expect(email.text).toContain('EC2V 6AA')
    expect(email.subject).toMatch(/EC2V 6AA/)
  })

  // ADR-0012: every MiCare email to a consumer carries a one-click opt-out.
  it('carries the one-click unsubscribe link', () => {
    expect(email.text).toContain(
      'https://micare.co.uk/notify-me/unsubscribe?token=xyz',
    )
  })
})
