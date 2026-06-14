import { describe, expect, it } from 'vitest'

import {
  ALLOWED_MIME_TYPES,
  MAX_BYTES,
  MAX_DIMENSION,
  MIN_DIMENSION,
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
