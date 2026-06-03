import { beforeAll, describe, expect, it } from 'vitest'

import { detectFaces } from '../../src/server/photo-detect'

const TINY_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47]) // PNG signature only

describe('detectFaces (PHOTO_CHECK_MOCK=true)', () => {
  beforeAll(() => {
    // tests/integration/setup.ts already sets this, but be explicit for the
    // reader.
    process.env.PHOTO_CHECK_MOCK = 'true'
  })

  it('returns 1 face for a generic filename', async () => {
    const result = await detectFaces(TINY_BUFFER, 'headshot.png')
    expect(result.faceCount).toBe(1)
  })

  it('returns 0 faces when the filename ends in -noface', async () => {
    const result = await detectFaces(TINY_BUFFER, 'sample-noface.png')
    expect(result.faceCount).toBe(0)
  })

  it('returns 2 faces when the filename ends in -multiface', async () => {
    const result = await detectFaces(TINY_BUFFER, 'sample-multiface.png')
    expect(result.faceCount).toBe(2)
  })
})
