// Thin createServerFn wrapper around uploadPractitionerPhoto. The route
// component imports this; integration tests import uploadPractitionerPhoto
// from ./photo-upload-impl directly so they exercise the real code path
// without bouncing through TanStack's RPC layer.
//
// The listing the photo lands on comes from the sealed session (ADR-0006),
// so the only input is the file.

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { uploadPractitionerPhoto } from './photo-upload-impl'
import type { PhotoUploadResult } from './photo-upload-impl'
import { readSession } from './session'

export type SubmitProfilePhotoResult =
  | { kind: 'unauthenticated' }
  | PhotoUploadResult

const inputSchema = z.object({
  fileBase64: z.string().min(1),
  filename: z.string().min(1),
})

export const submitProfilePhoto = createServerFn({ method: 'POST' })
  .inputValidator((raw: unknown) => inputSchema.parse(raw))
  .handler(async ({ data }): Promise<SubmitProfilePhotoResult> => {
    const session = await readSession()
    if (!session) return { kind: 'unauthenticated' }

    return uploadPractitionerPhoto({ ...data, email: session.email })
  })
