import { describe, expect, it } from 'vitest'

import {
  ALLOWED_MIME_TYPES,
  MAX_BYTES,
  MAX_DIMENSION,
  MIN_DIMENSION,
  PHOTO_CONSTRAINTS_HELP,
  PHOTO_SUBJECT_HELP,
  isAllowedMimeType,
  isWithinByteSize,
  isWithinDimensions,
} from '../../src/photo-policy'

describe('photo-policy constants', () => {
  it('caps file size at 5 MB', () => {
    expect(MAX_BYTES).toBe(5 * 1024 * 1024)
  })

  it('requires images between 400 and 4000 px on each side', () => {
    expect(MIN_DIMENSION).toBe(400)
    expect(MAX_DIMENSION).toBe(4000)
  })

  it('allows jpeg, png, and webp', () => {
    expect(ALLOWED_MIME_TYPES).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
    ])
  })
})

describe('isAllowedMimeType', () => {
  it('accepts each allowed MIME type', () => {
    for (const mime of ALLOWED_MIME_TYPES) {
      expect(isAllowedMimeType(mime)).toBe(true)
    }
  })

  it('rejects gif and unknown types', () => {
    expect(isAllowedMimeType('image/gif')).toBe(false)
    expect(isAllowedMimeType('application/pdf')).toBe(false)
    expect(isAllowedMimeType('')).toBe(false)
  })
})

describe('isWithinByteSize', () => {
  it('accepts a buffer one byte under the limit', () => {
    expect(isWithinByteSize(MAX_BYTES - 1)).toBe(true)
  })

  it('rejects a buffer over the limit', () => {
    expect(isWithinByteSize(MAX_BYTES + 1)).toBe(false)
  })

  it('rejects an empty buffer (zero is not a valid photo)', () => {
    expect(isWithinByteSize(0)).toBe(false)
  })
})

describe('isWithinDimensions', () => {
  it('accepts a 400×400 photo at the lower bound', () => {
    expect(isWithinDimensions({ width: 400, height: 400 })).toBe(true)
  })

  it('accepts a 4000×4000 photo at the upper bound', () => {
    expect(isWithinDimensions({ width: 4000, height: 4000 })).toBe(true)
  })

  it('rejects a too-small photo on either axis', () => {
    expect(isWithinDimensions({ width: 399, height: 400 })).toBe(false)
    expect(isWithinDimensions({ width: 400, height: 399 })).toBe(false)
  })

  it('rejects a too-large photo on either axis', () => {
    expect(isWithinDimensions({ width: 4001, height: 400 })).toBe(false)
    expect(isWithinDimensions({ width: 400, height: 4001 })).toBe(false)
  })
})

// The editor's photo guidance is the policy stated in words. It is derived
// from the constants above rather than typed out beside them, so a limit can
// never be raised in code and left wrong on the screen.
describe('PHOTO_CONSTRAINTS_HELP', () => {
  it('names every format the policy allows, in the words a Practitioner uses', () => {
    expect(PHOTO_CONSTRAINTS_HELP).toContain('JPEG, PNG or WebP')
  })

  it('states the size cap the policy enforces', () => {
    expect(PHOTO_CONSTRAINTS_HELP).toContain(
      `up to ${MAX_BYTES / 1024 / 1024} MB`,
    )
  })

  it('states both dimension bounds the policy enforces', () => {
    expect(PHOTO_CONSTRAINTS_HELP).toContain(
      `between ${MIN_DIMENSION} and ${MAX_DIMENSION} pixels on each side`,
    )
  })
})

describe('PHOTO_SUBJECT_HELP', () => {
  it('asks for the Practitioner, not the Practice', () => {
    expect(PHOTO_SUBJECT_HELP).toContain('Practitioner')
    expect(PHOTO_SUBJECT_HELP).toContain('Not your Practice')
  })

  it('asks for one front-facing face, which is what the check enforces', () => {
    expect(PHOTO_SUBJECT_HELP).toContain('front-facing')
    expect(PHOTO_SUBJECT_HELP).toContain('on your own')
  })
})
