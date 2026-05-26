// Server-only Stripe SDK init. Lazy singleton: the `Stripe` constructor is
// not called until the first checkout or webhook request, so dev startup
// under VITE_STRIPE_MOCK=true never instantiates the client. The API version
// is pinned to the version bundled with the installed `stripe` package so
// SDK types and runtime behaviour agree.

import Stripe from 'stripe'

import { env } from '../env.server'

let client: Stripe | undefined

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error(
      'getStripe() called without STRIPE_SECRET_KEY — VITE_STRIPE_MOCK must be true in this environment',
    )
  }
  client ??= new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-04-22.dahlia',
  })
  return client
}
