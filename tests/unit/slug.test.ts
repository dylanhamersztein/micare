import { describe, expect, it } from 'vitest'

import {
  generateProfileSlug,
  generateProfileUrl,
  generateShortId,
  resolveProfile,
  slugify,
} from '../../src/slug'
import type { ProfileRecord } from '../../src/slug'

describe('slugify', () => {
  it('lowercases and hyphenates multi-word text', () => {
    expect(slugify('Mary Jane Watson')).toBe('mary-jane-watson')
  })

  it('strips diacritics from accented characters', () => {
    expect(slugify('José Núñez')).toBe('jose-nunez')
  })

  it('collapses punctuation and existing hyphens into single hyphens', () => {
    expect(slugify("Mary-Jane O'Connor & Sons")).toBe('mary-jane-o-connor-sons')
  })

  it('trims leading and trailing separators', () => {
    expect(slugify('  Hello World  ')).toBe('hello-world')
  })
})

describe('generateProfileSlug', () => {
  it('joins name, practice, and town into one kebab slug', () => {
    expect(
      generateProfileSlug({
        fullName: 'Jane Smith',
        practiceName: 'Smith Optical',
        practiceTown: 'London',
      }),
    ).toBe('jane-smith-smith-optical-london')
  })

  it('drops null Practice fields without leaving empty segments', () => {
    expect(
      generateProfileSlug({
        fullName: 'Jane Smith',
        practiceName: null,
        practiceTown: null,
      }),
    ).toBe('jane-smith')
  })

  it('is deterministic for a given (name, practice, town) tuple', () => {
    const profile = {
      fullName: 'Jane Smith',
      practiceName: 'Smith Optical',
      practiceTown: 'London',
    }
    expect(generateProfileSlug(profile)).toBe(generateProfileSlug(profile))
  })

  it('drops only the null town, keeping practice name', () => {
    expect(
      generateProfileSlug({
        fullName: 'Jane Smith',
        practiceName: 'Smith Optical',
        practiceTown: null,
      }),
    ).toBe('jane-smith-smith-optical')
  })
})

describe('generateProfileUrl', () => {
  it('builds the /p/<short_id>/<slug> path', () => {
    expect(
      generateProfileUrl({
        shortId: 'a1b2c3d4',
        fullName: 'Jane Smith',
        practiceName: 'Smith Optical',
        practiceTown: 'London',
      }),
    ).toBe('/p/a1b2c3d4/jane-smith-smith-optical-london')
  })
})

describe('generateShortId', () => {
  it('returns an 8-character base62 string by default', () => {
    expect(generateShortId()).toMatch(/^[0-9A-Za-z]{8}$/)
  })

  it('honours a requested length', () => {
    expect(generateShortId(10)).toMatch(/^[0-9A-Za-z]{10}$/)
  })
})

const baseRecord: ProfileRecord = {
  shortId: 's4l5u6g7',
  fullName: 'Sophie Clarke',
  photoUrl: null,
  bio: null,
  services: null,
  languages: null,
  accessibilityNotes: null,
  acceptingNewPatients: true,
  practiceName: 'Clarke Vision',
  practiceAddressLine1: '8 Park Street',
  practiceAddressLine2: null,
  practiceAddressLine3: null,
  practicePostcode: 'BS1 5HX',
  practiceTown: 'Bristol',
  openingHours: null,
  byAppointmentOnly: false,
  bookingLinkUrl: 'https://clarkevision.example.co.uk/book',
  verificationStatus: 'verified',
  subscriptionStatus: 'active',
}

function makeRecord(overrides: Partial<ProfileRecord> = {}): ProfileRecord {
  return { ...baseRecord, ...overrides }
}

describe('resolveProfile', () => {
  const canonicalSlug = 'sophie-clarke-clarke-vision-bristol'

  it('returns unknown when the record is null', () => {
    expect(resolveProfile(null, 'anything')).toEqual({ kind: 'unknown' })
  })

  it('returns not-visible for a revoked Practitioner', () => {
    expect(
      resolveProfile(
        makeRecord({ verificationStatus: 'revoked' }),
        canonicalSlug,
      ),
    ).toEqual({ kind: 'not-visible' })
  })

  it('returns not-visible for a canceled subscription', () => {
    expect(
      resolveProfile(
        makeRecord({ subscriptionStatus: 'canceled' }),
        canonicalSlug,
      ),
    ).toEqual({ kind: 'not-visible' })
  })

  it('returns not-visible when the minimum fields are missing', () => {
    expect(
      resolveProfile(makeRecord({ bookingLinkUrl: null }), canonicalSlug),
    ).toEqual({ kind: 'not-visible' })
  })

  it('returns stale with the canonical URL when the slug does not match', () => {
    expect(resolveProfile(makeRecord(), 'an-old-slug')).toEqual({
      kind: 'stale',
      canonicalUrl: `/p/s4l5u6g7/${canonicalSlug}`,
    })
  })

  it('returns the canonical profile when the slug matches', () => {
    const result = resolveProfile(makeRecord(), canonicalSlug)
    expect(result.kind).toBe('canonical')
    if (result.kind !== 'canonical') throw new Error('expected canonical')
    expect(result.profile.slug).toBe(canonicalSlug)
    expect(result.profile.fullName).toBe('Sophie Clarke')
    expect(result.profile.services).toEqual([])
  })
})
