// Server-only orchestrator for profile photo upload. Resolves the
// Practitioner, then runs the byte-size check (cheapest), then sharp
// metadata to sniff the format and dimensions, then face-api detection. Only writes practitioners.photo_url
// on a pass. Never touches the visible column — AC #4 says the photo is
// optional and independent of required-field completeness.
//
// The Practitioner comes from the login email the sealed session carries
// (ADR-0006) — never from short_id, which is public in every
// /p/<short_id>/<slug> URL. short_id is still what names the stored object,
// so the row is resolved before any bytes are uploaded.
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
import { findPractitionerByEmail } from './practitioner-account'

export type PhotoUploadInput = {
  email: string
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
  const account = await findPractitionerByEmail(input.email)
  if (!account) return { kind: 'unknown' }

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
    shortId: account.shortId,
    buffer,
    mimeType,
  })

  await db.query(
    `update public.practitioners
        set photo_url = $2, updated_at = now()
      where id = $1`,
    [account.id, photoUrl],
  )

  return { kind: 'ok', photoUrl }
}
