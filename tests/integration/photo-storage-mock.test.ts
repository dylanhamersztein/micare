import { describe, expect, it } from 'vitest'

import { uploadProfilePhoto } from '../../src/server/photo-storage'

describe('uploadProfilePhoto (SUPABASE_STORAGE_MOCK=true)', () => {
  it('returns a data URL encoding the buffer for a png', async () => {
    const buffer = Buffer.from('not-a-real-image')
    const url = await uploadProfilePhoto({
      shortId: 'abcd1234',
      buffer,
      mimeType: 'image/png',
    })
    expect(url).toBe(`data:image/png;base64,${buffer.toString('base64')}`)
  })

  it('preserves the jpeg mime type in the data URL prefix', async () => {
    const buffer = Buffer.from('x')
    const url = await uploadProfilePhoto({
      shortId: 'efgh5678',
      buffer,
      mimeType: 'image/jpeg',
    })
    expect(url).toBe(`data:image/jpeg;base64,${buffer.toString('base64')}`)
  })

  it('preserves the webp mime type in the data URL prefix', async () => {
    const buffer = Buffer.from('x')
    const url = await uploadProfilePhoto({
      shortId: 'ijkl9012',
      buffer,
      mimeType: 'image/webp',
    })
    expect(url).toBe(`data:image/webp;base64,${buffer.toString('base64')}`)
  })
})
