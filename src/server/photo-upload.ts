// Thin createServerFn wrapper around uploadPractitionerPhoto. The route
// component imports this; integration tests import uploadPractitionerPhoto
// from ./photo-upload-impl directly so they exercise the real code path
// without bouncing through TanStack's RPC layer.

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { uploadPractitionerPhoto } from './photo-upload-impl'
import type { PhotoUploadResult } from './photo-upload-impl'

const inputSchema = z.object({
  shortId: z.string().trim().min(1),
  fileBase64: z.string().min(1),
  filename: z.string().min(1),
})

export const submitProfilePhoto = createServerFn({ method: 'POST' })
  .inputValidator((raw: unknown) => inputSchema.parse(raw))
  .handler(
    ({ data }): Promise<PhotoUploadResult> => uploadPractitionerPhoto(data),
  )
