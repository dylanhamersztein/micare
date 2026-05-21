// `profile` server function — thin createServerFn wrapper around the
// `resolveProfileUrl` deep module. The route loader imports this; integration
// tests import `resolveProfileUrl` from `./profile-impl` directly so they
// exercise the real code path without bouncing through TanStack's RPC layer.

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { resolveProfileUrl } from './profile-impl'

const profileInputSchema = z.object({
  shortId: z.string().trim().min(1),
  slug: z.string(),
})

export const getProfile = createServerFn({ method: 'GET' })
  .inputValidator((raw: unknown) => profileInputSchema.parse(raw))
  .handler(({ data }) => resolveProfileUrl(data.shortId, data.slug))
