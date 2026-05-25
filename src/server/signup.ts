// `signup` orchestrator — a thin createServerFn that validates the /signup
// payload and runs the `verification` deep module. The route imports this;
// the verification module is integration-tested directly via verification-impl.
// PRD module 8: "Signup orchestrator (validate -> verification.verify -> ...)".
// Stripe Checkout and Practitioner creation are deferred to a later slice.

import { createServerFn } from '@tanstack/react-start'

import { signupInputSchema } from '../signup-input'
import { verificationOutcome } from '../verification'
import type { VerificationOutcome } from '../verification'
import { verify } from './verification-impl'

export const submitSignup = createServerFn({ method: 'POST' })
  .inputValidator((raw: unknown) => signupInputSchema.parse(raw))
  .handler(async ({ data }): Promise<{ outcome: VerificationOutcome }> => {
    const result = await verify(
      data.professionCode,
      data.fullName,
      data.gocNumber,
    )
    return { outcome: verificationOutcome(result) }
  })
