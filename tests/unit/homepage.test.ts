import { access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { describeRouteGuards, routeSource } from './support/route-source'

import type { GuardedRoute } from './support/route-source'

// Until Slice 20 the homepage was still the Slice 1 bootstrap: a heading, a
// count, and every visible Practitioner in a bare list. It is the one page
// both audiences land on, so what it has to prove is that each of them finds
// its own way off it — and that the blanket listing, which was never the shape
// of the consumer journey, is gone.

const HOMEPAGE: ReadonlyArray<GuardedRoute> = [
  {
    file: 'index.tsx',
    markers: [
      'home-search-form',
      'home-search-query',
      'home-search-radius',
      'home-search-submit',
      'home-consumer-promise',
      'home-practitioner-offer',
      'home-practitioner-price',
      'home-practitioner-cta',
    ],
    hydrates: true,
  },
]

describeRouteGuards(HOMEPAGE)

describe('the consumer entry point', () => {
  it('hands the search to /search rather than answering it in place', async () => {
    expect(await routeSource('index.tsx')).toContain("to: '/search'")
  })

  it('offers the radii the search module allows, rather than typing three out', async () => {
    expect(await routeSource('index.tsx')).toContain('ALLOWED_RADII_MILES')
  })
})

describe('the Practitioner offer', () => {
  it('names the price the prospect is being asked for', async () => {
    expect(await routeSource('index.tsx')).toContain('£29')
  })

  it('routes the prospect to signup', async () => {
    expect(await routeSource('index.tsx')).toContain('to="/signup"')
  })
})

describe('the blanket listing of every Practitioner', () => {
  it('is gone from the homepage', async () => {
    expect(await routeSource('index.tsx')).not.toContain(
      'getVisiblePractitioners',
    )
  })

  it('took the server function nothing else called with it', async () => {
    const orphan = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../src/server/practitioners.ts',
    )

    await expect(access(orphan)).rejects.toThrow()
  })
})
