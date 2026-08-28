// The photo fixtures are only worth having if they contain what their names
// claim. The E2E suite runs with PHOTO_CHECK_MOCK=true, where the outcome is
// routed on the filename — so nothing there would notice if
// group-multiface.jpg quietly held one face, or none. This file is the check
// that notices: it runs the real SSD-MobileNet-v1 detector over the committed
// bytes and asserts the face count each filename promises.

import fs from 'node:fs/promises'
import path from 'node:path'

import { beforeAll, describe, expect, it, vi } from 'vitest'

import { PHOTO_FIXTURE_DIR } from '../fixtures/photos'

type DetectFaces = (
  buffer: Buffer,
  filename: string,
) => Promise<{ faceCount: number }>

let detectFaces: DetectFaces

beforeAll(async () => {
  // src/env.server.ts parses process.env once, at import time, so flipping the
  // flag means re-importing the module graph beneath it.
  vi.resetModules()
  process.env.PHOTO_CHECK_MOCK = 'false'
  ;({ detectFaces } = await import('../../src/server/photo-detect'))
}, 120_000)

async function faceCountOf(filename: string): Promise<number> {
  const buffer = await fs.readFile(path.join(PHOTO_FIXTURE_DIR, filename))
  const { faceCount } = await detectFaces(buffer, filename)
  return faceCount
}

describe('the committed photo fixtures, under real face detection', () => {
  it('finds exactly one face in headshot.jpg', async () => {
    expect(await faceCountOf('headshot.jpg')).toBe(1)
  })

  it('finds no face in landscape-noface.jpg', async () => {
    expect(await faceCountOf('landscape-noface.jpg')).toBe(0)
  })

  it('finds more than one face in group-multiface.jpg', async () => {
    expect(await faceCountOf('group-multiface.jpg')).toBeGreaterThan(1)
  })
}, 120_000)
