import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  PostcodeNotFoundError,
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
      postcode: 'EC2V 6AA',
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
