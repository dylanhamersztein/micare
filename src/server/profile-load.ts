// Thin createServerFn wrapper around loadEditableProfile. The route loader
// imports this; integration tests import loadEditableProfile from
// ./profile-load-impl directly so they exercise the real code path without
// bouncing through TanStack's RPC layer.

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { loadEditableProfile } from './profile-load-impl'

const inputSchema = z.object({ shortId: z.string().trim().min(1) })

export const loadProfile = createServerFn({ method: 'GET' })
  .inputValidator((raw: unknown) => inputSchema.parse(raw))
  .handler(({ data }) => loadEditableProfile(data.shortId))
