// `checkout` server function — thin createServerFn wrapper around
// startCheckoutImpl. Routes import this; tests import startCheckoutImpl
// from ./checkout-impl directly so they exercise the real code path
// without bouncing through TanStack's RPC layer.
//
// Checkout is the moment a Practitioner's MiCare account comes into
// existence, and it hands straight over to the profile editor — which, like
// the dashboard, resolves the Practitioner from the sealed session. So this
// is the second place a session is minted, alongside the magic-link callback
// (ADR-0023). The identity is read back off the row that was just inserted,
// never taken from the posted payload. setSession needs the per-request
// server runtime, which the impl (called directly by integration tests) does
// not have — so it lives here rather than in checkout-impl.ts.

import { createServerFn } from '@tanstack/react-start'

import { signupInputSchema } from '../signup-input'
import { startCheckoutImpl } from './checkout-impl'
import type { StartCheckoutResult } from './checkout-impl'
import { findPractitionerByEmail } from './practitioner-account'
import { setSession } from './session'

export const startCheckout = createServerFn({ method: 'POST' })
  .inputValidator((raw: unknown) => signupInputSchema.parse(raw))
  .handler(async ({ data }): Promise<StartCheckoutResult> => {
    const result = await startCheckoutImpl(data)

    const account = await findPractitionerByEmail(data.email)
    if (account) {
      await setSession({ practitionerId: account.id, email: account.email })
    }

    return result
  })
