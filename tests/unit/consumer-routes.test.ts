import { describeRouteGuards } from './support/route-source'

import type { GuardedRoute } from './support/route-source'

// The consumer-facing routes Slice 32 brought onto the design system. The
// guards themselves live in tests/unit/support/route-source.ts, shared with
// the acquisition routes.

const CONSUMER_ROUTES: ReadonlyArray<GuardedRoute> = [
  {
    file: 'search.tsx',
    markers: [
      'search-form',
      'search-query',
      'search-radius',
      'search-submit',
      'search-results',
      'search-empty',
      'search-error',
      'search-no-location',
      'notify-form',
      'notify-email',
      'notify-postcode',
      'notify-submit',
      'notify-submitted',
      'notify-error',
      'notify-dev-confirm',
    ],
    hydrates: true,
  },
  {
    file: 'p.$shortId.$slug.tsx',
    markers: [
      'profile-verified',
      'profile-photo',
      'profile-practice',
      'profile-hours',
      'profile-services',
      'profile-languages',
      'profile-accessibility',
      'profile-accepting',
      'profile-book',
      'profile-not-listed',
      'profile-not-found',
    ],
  },
  {
    file: 'notify-me/confirm.tsx',
    markers: ['notify-confirmed', 'notify-invalid'],
  },
  {
    file: 'notify-me/unsubscribe.tsx',
    markers: ['notify-unsubscribed', 'notify-invalid'],
  },
]

describeRouteGuards(CONSUMER_ROUTES)
