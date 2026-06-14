// Server-only orchestrator for profile photo upload. Runs the byte-size
// check first (cheapest), then sharp metadata to sniff the format and
// dimensions, then face-api detection. Only writes practitioners.photo_url
// on a pass. Never touches the visible column — AC #4 says the photo is
// optional and independent of required-field completeness.
//
// MIME type is detected from the file bytes, not trusted from the client.
// Browsers on some platforms (notably Linux/WSL without xdg-mime) hand us
// an empty file.type for valid JPEGs; sniffing via sharp removes that
// false-rejection.

import sharp from 'sharp'

import { isWithinByteSize, isWithinDimensions } from '../photo-policy'
import type { AllowedMimeType } from '../photo-policy'
import type { PhotoCheckOutcome } from '../photo-check-result'
import { db } from './db'
import { detectFaces } from './photo-detect'
import { uploadProfilePhoto } from './photo-storage'

export type PhotoUploadInput = {
  shortId: string
  fileBase64: string
  filename: string
}

export type PhotoUploadResult =
  | { kind: 'ok'; photoUrl: string }
  | { kind: Exclude<PhotoCheckOutcome, 'ok'> }
  | { kind: 'unknown' }

const FORMAT_TO_MIME: Record<string, AllowedMimeType> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export async function uploadPractitionerPhoto(
  input: PhotoUploadInput,
): Promise<PhotoUploadResult> {
  const buffer = Buffer.from(input.fileBase64, 'base64')
  if (!isWithinByteSize(buffer.byteLength)) {
    return { kind: 'too-large' }
  }

  let format: string | undefined
  let width: number | undefined
  let height: number | undefined
  try {
    const metadata = await sharp(buffer).metadata()
    format = metadata.format
    width = metadata.width
    height = metadata.height
  } catch {
    return { kind: 'unsupported-type' }
  }

  const mimeType = format ? FORMAT_TO_MIME[format] : undefined
  if (!mimeType) {
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
