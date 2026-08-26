import { describe, expect, it } from 'vitest'

import {
  PROFILE_FIELD_LIMITS,
  profileEditorInputSchema,
} from '../../src/profile-editor-input'

const VALID_BASE = {
  practiceName: 'Smith Optical',
  practiceAddressLine1: '12 Cheapside',
  practiceAddressLine2: null,
  practiceAddressLine3: null,
  practicePostcode: 'EC2V 6AA',
  practiceTown: 'London',
  bookingLinkUrl: 'https://smithoptical.example.co.uk/book',
  openingHours: { Monday: '9:00-17:30' },
  byAppointmentOnly: false,
  bio: null,
  photoUrl: null,
  services: [],
  languages: [],
  accessibilityNotes: null,
  acceptingNewPatients: true,
}

describe('profileEditorInputSchema', () => {
  it('accepts a complete payload with explicit opening hours', () => {
    expect(profileEditorInputSchema.parse(VALID_BASE)).toMatchObject({
      practiceName: 'Smith Optical',
      byAppointmentOnly: false,
    })
  })

  it('accepts a payload with by-appointment-only and no opening hours', () => {
    const result = profileEditorInputSchema.parse({
      ...VALID_BASE,
      openingHours: null,
      byAppointmentOnly: true,
    })
    expect(result.byAppointmentOnly).toBe(true)
    expect(result.openingHours).toBeNull()
  })

  it('rejects a payload that sets both opening hours and by-appointment-only', () => {
    const result = profileEditorInputSchema.safeParse({
      ...VALID_BASE,
      byAppointmentOnly: true,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toMatch(/either opening hours or/i)
  })

  it('rejects a payload with neither opening hours nor by-appointment-only', () => {
    const result = profileEditorInputSchema.safeParse({
      ...VALID_BASE,
      openingHours: null,
      byAppointmentOnly: false,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toMatch(/either opening hours or/i)
  })

  it('rejects an empty practice name', () => {
    const result = profileEditorInputSchema.safeParse({
      ...VALID_BASE,
      practiceName: '',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['practiceName'])
  })

  it('rejects a malformed UK postcode', () => {
    const result = profileEditorInputSchema.safeParse({
      ...VALID_BASE,
      practicePostcode: 'NOT-A-POSTCODE',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['practicePostcode'])
  })

  it('uppercases and normalises the postcode whitespace', () => {
    const result = profileEditorInputSchema.parse({
      ...VALID_BASE,
      practicePostcode: '  ec2v6aa  ',
    })
    expect(result.practicePostcode).toBe('EC2V 6AA')
  })

  it('rejects a booking link that is not an http(s) URL', () => {
    const result = profileEditorInputSchema.safeParse({
      ...VALID_BASE,
      bookingLinkUrl: 'javascript:alert(1)',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['bookingLinkUrl'])
  })
})

// The editor states each limit in its help text. Stating it is only honest if
// it is the same number the schema enforces, so both read it from here.
describe('PROFILE_FIELD_LIMITS', () => {
  const LIMITED = [
    ['practiceName', 'practiceName'],
    ['practiceAddressLine1', 'practiceAddressLine1'],
    ['practiceAddressLine2', 'practiceAddressLine2'],
    ['practiceAddressLine3', 'practiceAddressLine3'],
    ['practiceTown', 'practiceTown'],
    ['bio', 'bio'],
    ['accessibilityNotes', 'accessibilityNotes'],
  ] as const

  for (const [field] of LIMITED) {
    const limit = PROFILE_FIELD_LIMITS[field]

    it(`accepts ${field} at its stated ${limit}-character limit`, () => {
      expect(
        profileEditorInputSchema.safeParse({
          ...VALID_BASE,
          [field]: 'a'.repeat(limit),
        }).success,
      ).toBe(true)
    })

    it(`rejects ${field} one character over its stated limit`, () => {
      expect(
        profileEditorInputSchema.safeParse({
          ...VALID_BASE,
          [field]: 'a'.repeat(limit + 1),
        }).success,
      ).toBe(false)
    })
  }
})
