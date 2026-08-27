import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// Two properties of a route that no rendered test can reach — a TanStack file
// route cannot be mounted without a router, and the thing being asserted is
// the source itself.
//
// The palette guard is the one ADR-0016 could not express: the token tests
// prove `bg-primary` paints #0d4a45, but nothing stops a screen reaching past
// the tokens for `bg-black`. The marker guard is the one the E2E suite depends
// on — every `data-testid` it navigates by, and the `data-hydrated` marker
// Slice 6 added to stop a click racing the native form submit.

const ROUTES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../src/routes',
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

const STOCK_PALETTE_UTILITY = String.raw`\b(?:bg|text|border|decoration|divide|outline|ring|fill|stroke|accent|caret|placeholder|from|via|to|shadow)-(?:${STOCK_COLOURS})(?:-\d{2,3})?\b`

/**
 * Tailwind's own type scale. MiCare names its sizes for the job they do —
 * `text-meta`, `text-title`, `text-h1` — and the two names that collide,
 * `text-base` and `text-lg`, are redefined in the `@theme` block, so those
 * two are ours. Everything else on the stock ramp is drift.
 */
const STOCK_TYPE_SCALE_UTILITY = String.raw`\btext-(?:xs|sm|xl|[2-9]xl)\b`

/** A route the design system has claimed, and what must survive the claiming. */
export type GuardedRoute = {
  file: string
  /** Every marker the E2E suite navigates this route by, typed out in full. */
  markers: ReadonlyArray<string>
  /**
   * Markers the route builds from a template — seven opening-hours rows are
   * one expression, not seven attributes. The template is all the guard can
   * see, so the template is what it holds onto, with one marker it produces
   * named for the reader.
   */
  templatedMarkers?: ReadonlyArray<{ example: string; template: string }>
  /** Whether the route carries a form that must announce its hydration. */
  hydrates?: true
  /**
   * Whether the route ends a journey rather than a step in one — a dead end,
   * a token page, a confirmation — and so must wear the shared `NoticePage`
   * frame rather than a hand-built copy of it.
   */
  framesNotices?: true
}

/** The source of a route file, read fresh so the guard sees what shipped. */
export function routeSource(file: string): Promise<string> {
  return readFile(path.join(ROUTES, file), 'utf8')
}

/** Every stock-Tailwind colour utility the source reaches for. */
export function stockPaletteUtilities(source: string): Array<string> {
  return source.match(new RegExp(STOCK_PALETTE_UTILITY, 'g')) ?? []
}

/** Every stock-Tailwind type-scale utility the source reaches for. */
export function stockTypeScaleUtilities(source: string): Array<string> {
  return source.match(new RegExp(STOCK_TYPE_SCALE_UTILITY, 'g')) ?? []
}

/** Runs every guard over each route in a slice's migration. */
export function describeRouteGuards(routes: ReadonlyArray<GuardedRoute>): void {
  describe.each(routes)(
    '$file',
    ({ file, markers, templatedMarkers, hydrates, framesNotices }) => {
      it('reaches for MiCare tokens, never the stock Tailwind palette', async () => {
        expect(stockPaletteUtilities(await routeSource(file))).toEqual([])
      })

      it('sizes its type from MiCare tokens, never the stock Tailwind ramp', async () => {
        expect(stockTypeScaleUtilities(await routeSource(file))).toEqual([])
      })

      for (const marker of markers) {
        it(`still carries the ${marker} marker the E2E suite navigates by`, async () => {
          expect(await routeSource(file)).toContain(`data-testid="${marker}"`)
        })
      }

      for (const { example, template } of templatedMarkers ?? []) {
        it(`still builds the ${example} marker the E2E suite navigates by`, async () => {
          expect(await routeSource(file)).toContain(template)
        })
      }

      it.runIf(framesNotices)(
        'frames the end of a journey with the shared NoticePage',
        async () => {
          expect(await routeSource(file)).toContain('<NoticePage')
        },
      )

      it.runIf(hydrates)(
        'keeps the hydration marker that stops a click racing the native submit',
        async () => {
          expect(await routeSource(file)).toContain('data-hydrated=')
        },
      )
    },
  )
}
