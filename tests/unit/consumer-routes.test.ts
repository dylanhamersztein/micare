import { describeRouteGuards } from './support/route-source'

import type { GuardedRoute } from './support/route-source'

// The consumer-facing routes the design system has claimed — the four Slice 32
// converted, plus `/go`, whose Booking Link dead end followed later. The guards
// themselves live in tests/unit/support/route-source.ts, shared with the
// acquisition routes.

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
    framesNotices: true,
  },
  {
    file: 'notify-me/confirm.tsx',
    markers: ['notify-confirmed', 'notify-invalid'],
    framesNotices: true,
  },
  {
    file: 'notify-me/unsubscribe.tsx',
    markers: ['notify-unsubscribed', 'notify-invalid'],
    framesNotices: true,
  },
  {
    file: 'go.tsx',
    markers: ['go-not-found'],
    framesNotices: true,
  },
]

describeRouteGuards(CONSUMER_ROUTES)
