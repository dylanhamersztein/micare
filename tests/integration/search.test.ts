import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { searchPractitioners } from '../../src/server/search-impl'

type PostcodeBody = {
  status: number
  result?: { postcode: string; longitude: number; latitude: number }
  error?: string
}

type PlaceBody = {
  status: number
  result: Array<{ name_1: string; longitude: number; latitude: number }>
}

function mockPostcodesIoPostcode(response: PostcodeBody, httpStatus = 200) {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(JSON.stringify(response), {
      status: httpStatus,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

function mockPostcodesIoPlace(response: PlaceBody, httpStatus = 200) {
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

// Norwich centre — the Slice 3 visible fixture is at the same coordinates.
const NORWICH = {
  name_1: 'Norwich',
  longitude: 1.2933,
  latitude: 52.6289,
}

describe('searchPractitioners', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns visible practitioners within the radius, ordered by distance', async () => {
    mockPostcodesIoPostcode({ status: 200, result: LONDON })

    const results = await searchPractitioners({
      postcodeOrCity: 'EC2V 6AA',
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
    mockPostcodesIoPostcode({ status: 200, result: LONDON })
    const within5 = await searchPractitioners({
      postcodeOrCity: 'EC2V 6AA',
      radiusMiles: 5,
    })
    expect(within5.map((r) => r.fullName)).not.toContain('Marcus Owens')

    mockPostcodesIoPostcode({ status: 200, result: LONDON })
    const within15 = await searchPractitioners({
      postcodeOrCity: 'EC2V 6AA',
      radiusMiles: 15,
    })
    expect(within15.map((r) => r.fullName)).toContain('Marcus Owens')
  })

  it('excludes Practitioners that fail the visibility predicate', async () => {
    mockPostcodesIoPostcode({ status: 200, result: LONDON })

    const results = await searchPractitioners({
      postcodeOrCity: 'EC2V 6AA',
      radiusMiles: 5,
    })

    expect(results.map((r) => r.fullName)).not.toContain('Hidden Practitioner')
    expect(results.map((r) => r.fullName)).not.toContain('John Doe')
  })

  it('throws PostcodeNotFoundError when postcodes.io 404s', async () => {
    mockPostcodesIoPostcode({ status: 404, error: 'Postcode not found' }, 404)

    await expect(
      searchPractitioners({ postcodeOrCity: 'ZZ1 1ZZ', radiusMiles: 5 }),
    ).rejects.toMatchObject({ name: 'PostcodeNotFoundError' })
  })

  it('rejects radii outside the allowed set', async () => {
    await expect(
      // @ts-expect-error — 7 is not in the allowed union
      searchPractitioners({ postcodeOrCity: 'EC2V 6AA', radiusMiles: 7 }),
    ).rejects.toThrow()
  })

  it('returns visible practitioners for an exact city match', async () => {
    mockPostcodesIoPlace({ status: 200, result: [NORWICH] })

    const results = await searchPractitioners({
      postcodeOrCity: 'Norwich',
      radiusMiles: 5,
    })

    const names = results.map((r) => r.fullName)
    expect(names).toContain('Eleanor Hughes')
    expect(names).not.toContain('Jane Smith')
  })

  it('resolves a multi-word place name through the places endpoint', async () => {
    mockPostcodesIoPlace({
      status: 200,
      result: [
        {
          name_1: 'Stratford-upon-Avon',
          longitude: -1.7064,
          latitude: 52.1927,
        },
      ],
    })

    const results = await searchPractitioners({
      postcodeOrCity: 'Stratford upon Avon',
      radiusMiles: 5,
    })

    // No Practitioner is seeded near Stratford — same empty-results shape as
    // a postcode lookup with no nearby Practitioners.
    expect(results).toEqual([])
    const callUrl = vi.mocked(fetch).mock.calls[0][0]
    expect(callUrl).toMatch(/\/places\?q=/)
  })

  it('throws PlaceNotFoundError when the city/town is unresolvable', async () => {
    mockPostcodesIoPlace({ status: 200, result: [] })

    await expect(
      searchPractitioners({
        postcodeOrCity: 'Atlantisburg',
        radiusMiles: 5,
      }),
    ).rejects.toMatchObject({ name: 'PlaceNotFoundError' })
  })
})
