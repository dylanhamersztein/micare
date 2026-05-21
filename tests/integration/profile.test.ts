import { describe, expect, it } from 'vitest'

import { resolveProfileUrl } from '../../src/server/profile-impl'

describe('resolveProfileUrl', () => {
  const canonicalSlug = 'sophie-clarke-clarke-vision-bristol'

  it('returns the canonical profile for a matching short_id + slug', async () => {
    const result = await resolveProfileUrl('s4l5u6g7', canonicalSlug)

    expect(result.kind).toBe('canonical')
    if (result.kind !== 'canonical') throw new Error('expected canonical')
    expect(result.profile.fullName).toBe('Sophie Clarke')
    expect(result.profile.practiceName).toBe('Clarke Vision')
    expect(result.profile.practiceTown).toBe('Bristol')
    expect(result.profile.services).toContain('Contact lens fitting')
    expect(result.profile.languages).toContain('French')
    expect(result.profile.openingHours?.Monday).toBe('9:00-17:30')
  })

  it('returns stale with the canonical URL for a mismatched slug', async () => {
    const result = await resolveProfileUrl('s4l5u6g7', 'not-the-real-slug')

    expect(result).toEqual({
      kind: 'stale',
      canonicalUrl: `/p/s4l5u6g7/${canonicalSlug}`,
    })
  })

  it('returns not-visible for a revoked Practitioner', async () => {
    const result = await resolveProfileUrl(
      'r4v5o6k7',
      'daniel-reed-reed-eye-care-leeds',
    )

    expect(result).toEqual({ kind: 'not-visible' })
  })

  it('returns unknown for an unrecognised short_id', async () => {
    const result = await resolveProfileUrl('zzzzzzzz', 'whatever')

    expect(result).toEqual({ kind: 'unknown' })
  })
})
