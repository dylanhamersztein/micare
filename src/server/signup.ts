// `signup` server function — thin createServerFn wrapper around
// submitSignupImpl. Routes import this; tests import submitSignupImpl from
// ./signup-impl directly so they exercise the real code path without
// bouncing through TanStack's RPC layer.
// PRD module 8: "Signup orchestrator (validate -> verification.verify -> ...)".

import { createServerFn } from '@tanstack/react-start'

import { signupRequestSchema } from '../signup-input'
import { submitSignupImpl } from './signup-impl'
import type { VerificationOutcome } from '../verification'

export const submitSignup = createServerFn({ method: 'POST' })
  .inputValidator((raw: unknown) => signupRequestSchema.parse(raw))
  .handler(async ({ data }): Promise<{ outcome: VerificationOutcome }> => {
    const { retry, ...input } = data
    return submitSignupImpl(input, { retry })
  })
