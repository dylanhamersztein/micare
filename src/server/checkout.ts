// `checkout` server function — thin createServerFn wrapper around
// startCheckoutImpl. Routes import this; tests import startCheckoutImpl
// from ./checkout-impl directly so they exercise the real code path
// without bouncing through TanStack's RPC layer.

import { createServerFn } from '@tanstack/react-start'

import { signupInputSchema } from '../signup-input'
import { startCheckoutImpl } from './checkout-impl'
import type { StartCheckoutResult } from './checkout-impl'

export const startCheckout = createServerFn({ method: 'POST' })
  .inputValidator((raw: unknown) => signupInputSchema.parse(raw))
  .handler(({ data }): Promise<StartCheckoutResult> => startCheckoutImpl(data))
