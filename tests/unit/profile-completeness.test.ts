import { describe, expect, it } from 'vitest'

import { profileCompleteness } from '../../src/profile-completeness'

const EMPTY = {
  bio: null,
  photoUrl: null,
  services: [],
  languages: [],
  accessibilityNotes: null,
}

const FULL = {
  bio: 'Decade of experience.',
  photoUrl: 'https://example.test/me.jpg',
  services: ['Eye exam'],
  languages: ['English'],
  accessibilityNotes: 'Step-free access.',
}

describe('profileCompleteness', () => {
  it('reports 0/5 with all polish fields missing', () => {
    expect(profileCompleteness(EMPTY)).toEqual({
      filled: 0,
      total: 5,
      missing: [
        'bio',
        'photoUrl',
        'services',
        'languages',
        'accessibilityNotes',
      ],
    })
  })

  it('reports 5/5 with every polish field filled', () => {
    expect(profileCompleteness(FULL)).toEqual({
      filled: 5,
      total: 5,
      missing: [],
    })
  })

  it('treats empty strings as missing', () => {
    expect(
      profileCompleteness({ ...EMPTY, bio: '   ', accessibilityNotes: '' }),
    ).toEqual({
      filled: 0,
      total: 5,
      missing: [
        'bio',
        'photoUrl',
        'services',
        'languages',
        'accessibilityNotes',
      ],
    })
  })

  it('treats empty arrays as missing but non-empty arrays as filled', () => {
    const result = profileCompleteness({ ...EMPTY, services: ['Eye exam'] })
    expect(result.filled).toBe(1)
    expect(result.missing).not.toContain('services')
    expect(result.missing).toContain('languages')
  })

  it('counts partial fills correctly', () => {
    const result = profileCompleteness({
      ...EMPTY,
      bio: 'Hi',
      photoUrl: 'https://example.test/me.jpg',
    })
    expect(result.filled).toBe(2)
    expect(result.total).toBe(5)
    expect(result.missing).toEqual([
      'services',
      'languages',
      'accessibilityNotes',
    ])
  })
})
