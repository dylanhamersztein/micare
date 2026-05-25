import { describe, expect, it } from 'vitest'

import { signupInputSchema } from '../../src/signup-input'

const valid = {
  fullName: 'Jane Smith',
  professionCode: 'optician',
  gocNumber: '01-123456', // digit-prefix optometrist; "D-17909" (dispensing) is also valid
  email: 'jane@smithoptical.example.co.uk',
}

describe('signupInputSchema', () => {
  it('accepts a well-formed signup payload', () => {
    expect(signupInputSchema.parse(valid)).toEqual(valid)
  })

  it('trims surrounding whitespace from the full name', () => {
    expect(signupInputSchema.parse({ ...valid, fullName: '  Jane Smith  ' }))
      .toMatchObject({ fullName: 'Jane Smith' })
  })

  it('rejects an empty full name', () => {
    expect(signupInputSchema.safeParse({ ...valid, fullName: '' }).success).toBe(
      false,
    )
  })

  it('accepts a letter-prefix GOC number (e.g. dispensing optician)', () => {
    expect(
      signupInputSchema.safeParse({ ...valid, gocNumber: 'D-17909' }).success,
    ).toBe(true)
  })

  it('rejects a GOC number that does not match the prefix-hyphen-digits shape', () => {
    expect(signupInputSchema.safeParse({ ...valid, gocNumber: '12345' }).success)
      .toBe(false)
    expect(
      signupInputSchema.safeParse({ ...valid, gocNumber: '01_123456' }).success,
    ).toBe(false)
  })

  it('rejects an invalid email', () => {
    expect(
      signupInputSchema.safeParse({ ...valid, email: 'not-an-email' }).success,
    ).toBe(false)
  })

  it('rejects an unknown profession code', () => {
    expect(
      signupInputSchema.safeParse({ ...valid, professionCode: 'physio' }).success,
    ).toBe(false)
  })
})
