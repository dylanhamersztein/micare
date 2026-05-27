// Thin createServerFn wrapper around updateProfile. The route component
// imports this; integration tests import updateProfile from
// ./profile-update-impl directly so they exercise the real code path
// without bouncing through TanStack's RPC layer.

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { updateProfile } from './profile-update-impl'
import type { ProfileUpdateResult } from './profile-update-impl'

const inputSchema = z.object({
  shortId: z.string().trim().min(1),
  input: z.unknown(),
})

export const submitProfileUpdate = createServerFn({ method: 'POST' })
  .inputValidator((raw: unknown) => inputSchema.parse(raw))
  .handler(({ data }): Promise<ProfileUpdateResult> =>
    updateProfile(data.shortId, data.input),
  )
