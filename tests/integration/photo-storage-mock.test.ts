import { describe, expect, it } from 'vitest'

import { uploadProfilePhoto } from '../../src/server/photo-storage'

describe('uploadProfilePhoto (SUPABASE_STORAGE_MOCK=true)', () => {
  it('returns a deterministic mock URL keyed on shortId + extension', async () => {
    const buffer = Buffer.from('not-a-real-image')
    const url = await uploadProfilePhoto({
      shortId: 'abcd1234',
      buffer,
      mimeType: 'image/png',
    })
    expect(url).toBe(
      'https://storage.mock/practitioner-photos/abcd1234/photo.png',
    )
  })

  it('picks the right extension for jpeg', async () => {
    const url = await uploadProfilePhoto({
      shortId: 'efgh5678',
      buffer: Buffer.from('x'),
      mimeType: 'image/jpeg',
    })
    expect(url).toBe(
      'https://storage.mock/practitioner-photos/efgh5678/photo.jpg',
    )
  })

  it('picks the right extension for webp', async () => {
    const url = await uploadProfilePhoto({
      shortId: 'ijkl9012',
      buffer: Buffer.from('x'),
      mimeType: 'image/webp',
    })
    expect(url).toBe(
      'https://storage.mock/practitioner-photos/ijkl9012/photo.webp',
    )
  })
})
