import { describeRouteGuards } from './support/route-source'

import type { GuardedRoute } from './support/route-source'

// The acquisition routes: where a Practitioner arrives, is checked against the
// GOC register, and either pays or does not. Same two guards as the consumer
// routes — no stock palette, and every marker the E2E suite navigates by still
// in place. The signup hydration marker matters most of all: without it a
// click races the native submit and reloads the page with the prospect's
// details wiped.

const ACQUISITION_ROUTES: ReadonlyArray<GuardedRoute> = [
  {
    file: 'signup.tsx',
    markers: [
      'signup-form',
      'signup-full-name',
      'signup-profession',
      'signup-goc-number',
      'signup-email',
      'signup-invalid',
      'signup-submit',
      'signup-verified',
      'signup-rejected',
      'signup-pending',
      'signup-retry',
      'signup-continue-to-payment',
      'checkout-error',
      'checkout-retry',
    ],
    hydrates: true,
  },
  {
    file: 'login.tsx',
    markers: [
      'login-form',
      'login-email',
      'login-submit',
      'login-sent',
      'login-invalid',
      'login-link-error',
      'login-mock-panel',
      'dev-magic-link',
    ],
    hydrates: true,
  },
  // No component at all — the callback is a server-route handler. It is
  // guarded anyway, so the day it grows a rendered error state that state is
  // born on the design system rather than retrofitted onto it.
  { file: 'auth/callback.tsx', markers: [] },
  { file: 'checkout/success.tsx', markers: ['checkout-success'] },
  { file: 'checkout/cancel.tsx', markers: ['checkout-cancel'] },
]

describeRouteGuards(ACQUISITION_ROUTES)
