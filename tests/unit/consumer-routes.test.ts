import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// Two properties of the consumer-facing routes that no rendered test can
// reach — a TanStack file route cannot be mounted without a router, and the
// thing being asserted is the source itself.
//
// The palette guard is the one ADR-0016 could not express: the token tests
// prove `bg-primary` paints #0d4a45, but nothing stops a screen reaching past
// the tokens for `bg-black`. The marker guard is the one the E2E suite depends
// on — every `data-testid` it navigates by, and the `data-hydrated` marker
// Slice 6 added to stop a click racing the native form submit.

const ROUTES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src/routes',
)

/** Tailwind's own colour names. MiCare's palette has its own (ADR-0016). */
const STOCK_COLOURS = [
  'black',
  'white',
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
].join('|')

const STOCK_PALETTE_UTILITY = new RegExp(
  String.raw`\b(?:bg|text|border|decoration|divide|outline|ring|fill|stroke|accent|caret|placeholder|from|via|to|shadow)-(?:${STOCK_COLOURS})(?:-\d{2,3})?\b`,
  'g',
)

type ConsumerRoute = {
  file: string
  /** Every marker the E2E suite navigates this route by. */
  markers: ReadonlyArray<string>
  /** Whether the route carries a form that must announce its hydration. */
  hydrates?: true
}

const CONSUMER_ROUTES: ReadonlyArray<ConsumerRoute> = [
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

function source(file: string): Promise<string> {
  return readFile(path.join(ROUTES, file), 'utf8')
}

describe.each(CONSUMER_ROUTES)('$file', ({ file, markers, hydrates }) => {
  it('reaches for MiCare tokens, never the stock Tailwind palette', async () => {
    expect((await source(file)).match(STOCK_PALETTE_UTILITY) ?? []).toEqual([])
  })

  for (const marker of markers) {
    it(`still carries the ${marker} marker the E2E suite navigates by`, async () => {
      expect(await source(file)).toContain(`data-testid="${marker}"`)
    })
  }

  it.runIf(hydrates)(
    'keeps the hydration marker that stops a click racing the native submit',
    async () => {
      expect(await source(file)).toContain('data-hydrated=')
    },
  )
})
