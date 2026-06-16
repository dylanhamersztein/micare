// Thin createServerFn shims for the magic-link request and sign-out. The
// testable logic lives in auth-impl.ts; cookie clearing lives in session.ts.

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { requestMagicLinkImpl } from './auth-impl'
import type { RequestMagicLinkResult } from './auth-impl'
import { clearSession } from './session'

const requestSchema = z.object({ email: z.string().trim().email() })

export const requestMagicLink = createServerFn({ method: 'POST' })
  .inputValidator((raw: unknown) => requestSchema.parse(raw))
  .handler(
    ({ data }): Promise<RequestMagicLinkResult> =>
      requestMagicLinkImpl(data.email),
  )

export const signOut = createServerFn({ method: 'POST' }).handler(
  async (): Promise<{ ok: true }> => {
    await clearSession()
    return { ok: true }
  },
)
