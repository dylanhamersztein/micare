// Thin createServerFn wrapper around updateProfile. The route component
// imports this; integration tests import updateProfile from
// ./profile-update-impl directly so they exercise the real code path
// without bouncing through TanStack's RPC layer.
//
// The Practitioner being saved comes from the sealed session (ADR-0006), so
// the only input is the form itself.

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { updateProfile } from './profile-update-impl'
import type { ProfileUpdateResult } from './profile-update-impl'
import { readSession } from './session'

export type SubmitProfileUpdateResult =
  | { kind: 'unauthenticated' }
  | ProfileUpdateResult

const inputSchema = z.object({ input: z.unknown() })

export const submitProfileUpdate = createServerFn({ method: 'POST' })
  .inputValidator((raw: unknown) => inputSchema.parse(raw))
  .handler(async ({ data }): Promise<SubmitProfileUpdateResult> => {
    const session = await readSession()
    if (!session) return { kind: 'unauthenticated' }

    return updateProfile(session.email, data.input)
  })
