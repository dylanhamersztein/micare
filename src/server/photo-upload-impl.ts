// Server-only orchestrator for profile photo upload. Runs the pure
// policy checks first (cheapest), the sharp metadata check next, and
// finally face-api detection. Only writes practitioners.photo_url on a
// pass. Never touches the visible column — AC #4 says the photo is
// optional and independent of required-field completeness.

import sharp from 'sharp'

import {
  isAllowedMimeType,
  isWithinByteSize,
  isWithinDimensions,
} from '../photo-policy'
import type { AllowedMimeType } from '../photo-policy'
import type { PhotoCheckOutcome } from '../photo-check-result'
import { db } from './db'
import { detectFaces } from './photo-detect'
import { uploadProfilePhoto } from './photo-storage'

export type PhotoUploadInput = {
  shortId: string
  fileBase64: string
  mimeType: string
  filename: string
}

export type PhotoUploadResult =
  | { kind: 'ok'; photoUrl: string }
  | { kind: Exclude<PhotoCheckOutcome, 'ok'> }
  | { kind: 'unknown' }

export async function uploadPractitionerPhoto(
  input: PhotoUploadInput,
): Promise<PhotoUploadResult> {
  if (!isAllowedMimeType(input.mimeType)) {
    return { kind: 'unsupported-type' }
  }
  const mimeType: AllowedMimeType = input.mimeType

  const buffer = Buffer.from(input.fileBase64, 'base64')
  if (!isWithinByteSize(buffer.byteLength)) {
    return { kind: 'too-large' }
  }

  let width: number | undefined
  let height: number | undefined
  try {
    const metadata = await sharp(buffer).metadata()
    width = metadata.width
    height = metadata.height
  } catch {
    return { kind: 'unsupported-type' }
  }
  if (!width || !height || !isWithinDimensions({ width, height })) {
    return { kind: 'too-small' }
  }

  const { faceCount } = await detectFaces(buffer, input.filename)
  if (faceCount === 0) return { kind: 'no-face' }
  if (faceCount > 1) return { kind: 'multi-face' }

  const photoUrl = await uploadProfilePhoto({
    shortId: input.shortId,
    buffer,
    mimeType,
  })

  const updated = await db.query<{ short_id: string }>(
    `update public.practitioners
        set photo_url = $2, updated_at = now()
      where short_id = $1
      returning short_id`,
    [input.shortId, photoUrl],
  )
  if (updated.rowCount === 0) {
    return { kind: 'unknown' }
  }

  return { kind: 'ok', photoUrl }
}
