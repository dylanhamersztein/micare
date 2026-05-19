import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { searchPractitioners } from '../../src/server/search'

type GeocodeResponse = {
  status: number
  result?: { postcode: string; longitude: number; latitude: number }
  error?: string
}

function mockPostcodesIo(response: GeocodeResponse, httpStatus = 200) {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(JSON.stringify(response), {
      status: httpStatus,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

// EC2V 6AA — the Slice 1 visible fixture.
const LONDON = {
  postcode: 'EC2V 6AA',
  longitude: -0.0921,
  latitude: 51.5144,
}

describe('searchPractitioners', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns visible practitioners within the radius, ordered by distance', async () => {
    mockPostcodesIo({ status: 200, result: LONDON })

    const results = await searchPractitioners({
      postcode: 'EC2V 6AA',
      radiusMiles: 5,
    })

    const names = results.map((r) => r.fullName)
    expect(names).toEqual(['Jane Smith', 'Priya Patel'])
    for (let i = 1; i < results.length; i += 1) {
      expect(results[i].distanceMiles).toBeGreaterThanOrEqual(
        results[i - 1].distanceMiles,
      )
    }
  })

  it('honours the radius cutoff', async () => {
    mockPostcodesIo({ status: 200, result: LONDON })
    const within5 = await searchPractitioners({
      postcode: 'EC2V 6AA',
      radiusMiles: 5,
    })
    expect(within5.map((r) => r.fullName)).not.toContain('Marcus Owens')

    mockPostcodesIo({ status: 200, result: LONDON })
    const within15 = await searchPractitioners({
      postcode: 'EC2V 6AA',
      radiusMiles: 15,
    })
    expect(within15.map((r) => r.fullName)).toContain('Marcus Owens')
  })

  it('excludes Practitioners that fail the visibility predicate', async () => {
    mockPostcodesIo({ status: 200, result: LONDON })

    const results = await searchPractitioners({
      postcode: 'EC2V 6AA',
      radiusMiles: 5,
    })

    expect(results.map((r) => r.fullName)).not.toContain('Hidden Practitioner')
    expect(results.map((r) => r.fullName)).not.toContain('John Doe')
  })

  it('throws PostcodeNotFoundError when postcodes.io 404s', async () => {
    mockPostcodesIo({ status: 404, error: 'Postcode not found' }, 404)

    await expect(
      searchPractitioners({ postcode: 'ZZ1 1ZZ', radiusMiles: 5 }),
    ).rejects.toMatchObject({ name: 'PostcodeNotFoundError' })
  })

  it('rejects radii outside the allowed set', async () => {
    await expect(
      // @ts-expect-error — 7 is not in the allowed union
      searchPractitioners({ postcode: 'EC2V 6AA', radiusMiles: 7 }),
    ).rejects.toThrow()
  })
})
