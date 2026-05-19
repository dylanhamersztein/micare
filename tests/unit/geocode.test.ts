import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LocationNotFoundError,
  PlaceNotFoundError,
  PostcodeNotFoundError,
  geocodeLocation,
  geocodePlace,
  geocodePostcode,
} from '../../src/server/geocode'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('geocodePostcode', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns longitude/latitude for a 200 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        status: 200,
        result: { postcode: 'EC2V 6AA', longitude: -0.0921, latitude: 51.5144 },
      }),
    )

    const point = await geocodePostcode('ec2v6aa')

    expect(point).toEqual({
      label: 'EC2V 6AA',
      longitude: -0.0921,
      latitude: 51.5144,
    })
    expect(fetch).toHaveBeenCalledWith(
      'https://api.postcodes.io/postcodes/EC2V%206AA',
      expect.any(Object),
    )
  })

  it('throws PostcodeNotFoundError on 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ status: 404, error: 'Postcode not found' }, 404),
    )

    await expect(geocodePostcode('ZZ1 1ZZ')).rejects.toBeInstanceOf(
      PostcodeNotFoundError,
    )
  })

  it('PostcodeNotFoundError is a LocationNotFoundError', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ status: 404, error: 'Postcode not found' }, 404),
    )

    await expect(geocodePostcode('ZZ1 1ZZ')).rejects.toBeInstanceOf(
      LocationNotFoundError,
    )
  })

  it('throws a generic Error on 5xx', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ status: 500, error: 'boom' }, 500),
    )

    await expect(geocodePostcode('EC2V 6AA')).rejects.toThrow(/postcodes\.io/i)
  })

  it('normalises whitespace and case before requesting', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        status: 200,
        result: { postcode: 'EC2V 6AA', longitude: -0.09, latitude: 51.51 },
      }),
    )

    await geocodePostcode('  ec2v 6aa  ')

    expect(fetch).toHaveBeenCalledWith(
      'https://api.postcodes.io/postcodes/EC2V%206AA',
      expect.any(Object),
    )
  })
})

describe('geocodePlace', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the first result for a single-word city', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        status: 200,
        result: [
          { name_1: 'Norwich', longitude: 1.2933, latitude: 52.6289 },
          { name_1: 'Norwich Road', longitude: 0.99, latitude: 52.3 },
        ],
      }),
    )

    const point = await geocodePlace('Norwich')

    expect(point).toEqual({
      label: 'Norwich',
      longitude: 1.2933,
      latitude: 52.6289,
    })
    expect(fetch).toHaveBeenCalledWith(
      'https://api.postcodes.io/places?q=Norwich',
      expect.any(Object),
    )
  })

  it('handles multi-word place names by URL-encoding the query', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        status: 200,
        result: [
          {
            name_1: 'Stratford-upon-Avon',
            longitude: -1.7064,
            latitude: 52.1927,
          },
        ],
      }),
    )

    const point = await geocodePlace('  stratford upon avon ')

    expect(point.label).toBe('Stratford-upon-Avon')
    expect(fetch).toHaveBeenCalledWith(
      'https://api.postcodes.io/places?q=stratford%20upon%20avon',
      expect.any(Object),
    )
  })

  it('throws PlaceNotFoundError when result is empty', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ status: 200, result: [] }),
    )

    await expect(geocodePlace('Atlantisburg')).rejects.toBeInstanceOf(
      PlaceNotFoundError,
    )
  })

  it('PlaceNotFoundError is a LocationNotFoundError', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ status: 200, result: [] }),
    )

    await expect(geocodePlace('Atlantisburg')).rejects.toBeInstanceOf(
      LocationNotFoundError,
    )
  })

  it('throws PlaceNotFoundError when the API returns null result', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ status: 200, result: null }),
    )

    await expect(geocodePlace('???')).rejects.toBeInstanceOf(PlaceNotFoundError)
  })

  it('throws a generic Error on a non-200 HTTP response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ status: 500, error: 'boom' }, 500),
    )

    await expect(geocodePlace('Norwich')).rejects.toThrow(/postcodes\.io/i)
  })

  it('rejects an empty input without calling fetch', async () => {
    await expect(geocodePlace('   ')).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('geocodeLocation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('routes a full UK postcode to the postcodes endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        status: 200,
        result: { postcode: 'EC2V 6AA', longitude: -0.0921, latitude: 51.5144 },
      }),
    )

    await geocodeLocation('ec2v 6aa')

    expect(fetch).toHaveBeenCalledWith(
      'https://api.postcodes.io/postcodes/EC2V%206AA',
      expect.any(Object),
    )
  })

  it('routes a city/town name to the places endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        status: 200,
        result: [{ name_1: 'Norwich', longitude: 1.2933, latitude: 52.6289 }],
      }),
    )

    const point = await geocodeLocation('Norwich')

    expect(point).toEqual({
      label: 'Norwich',
      longitude: 1.2933,
      latitude: 52.6289,
    })
    expect(fetch).toHaveBeenCalledWith(
      'https://api.postcodes.io/places?q=Norwich',
      expect.any(Object),
    )
  })

  it('routes a multi-word place name to the places endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        status: 200,
        result: [
          {
            name_1: 'Stratford-upon-Avon',
            longitude: -1.7064,
            latitude: 52.1927,
          },
        ],
      }),
    )

    await geocodeLocation('stratford upon avon')

    expect(vi.mocked(fetch).mock.calls[0][0]).toMatch(/\/places\?q=/)
  })

  it('surfaces PostcodeNotFoundError for an unknown postcode', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ status: 404, error: 'Postcode not found' }, 404),
    )

    await expect(geocodeLocation('ZZ1 1ZZ')).rejects.toBeInstanceOf(
      PostcodeNotFoundError,
    )
  })

  it('surfaces PlaceNotFoundError for an unresolvable city name', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ status: 200, result: [] }),
    )

    await expect(geocodeLocation('Atlantisburg')).rejects.toBeInstanceOf(
      PlaceNotFoundError,
    )
  })
})
