// Where the committed photo fixtures live, and what each one is for.
//
// The images are real photographs, not generated rectangles: the profile
// photo check runs SSD-MobileNet-v1 over the uploaded bytes, and a flat fill
// detects as no-face whatever you call it. See README.md in this directory
// for where the images came from and how to replace them.
//
// The filenames carry the PHOTO_CHECK_MOCK suffixes (-noface, -multiface) on
// purpose, so the same bytes drive the same outcome whether the mock is
// routing on the name or the detector is reading the pixels.

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const PHOTO_FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url))

/** A photograph of one person, front-facing: the upload that should pass. */
export const SINGLE_FACE_PHOTO = 'headshot.jpg'

/** A photograph with no person in it: the `no-face` rejection. */
export const NO_FACE_PHOTO = 'landscape-noface.jpg'

/** A photograph of several people: the `multi-face` rejection. */
export const MULTI_FACE_PHOTO = 'group-multiface.jpg'

export function photoFixturePath(filename: string): string {
  return path.join(PHOTO_FIXTURE_DIR, filename)
}

export async function readPhotoFixture(filename: string): Promise<Buffer> {
  return fs.readFile(photoFixturePath(filename))
}
