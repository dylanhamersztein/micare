import { describe, expect, it } from 'vitest'

import {
  generateProfileSlug,
  generateProfileUrl,
  generateShortId,
  slugify,
} from '../../src/slug'

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
