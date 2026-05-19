// Thin HTTP wrapper around postcodes.io. The `search` deep module owns
// geocoding as an internal collaborator — tests mock this module at the
// `fetch` boundary, never the function itself.

export type GeocodedPostcode = {
  postcode: string
  longitude: number
  latitude: number
}

export class PostcodeNotFoundError extends Error {
  constructor(postcode: string) {
    super(`Postcode not found: ${postcode}`)
    this.name = 'PostcodeNotFoundError'
  }
}

function formatUkPostcode(raw: string): string {
  const collapsed = raw.trim().toUpperCase().replace(/\s+/g, '')
  if (collapsed.length < 5) return collapsed
  return `${collapsed.slice(0, collapsed.length - 3)} ${collapsed.slice(-3)}`
}

export async function geocodePostcode(raw: string): Promise<GeocodedPostcode> {
  const postcode = formatUkPostcode(raw)
  const url = `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`

  const response = await fetch(url, {
    headers: { accept: 'application/json' },
  })

  if (response.status === 404) {
    throw new PostcodeNotFoundError(postcode)
  }

  if (!response.ok) {
    throw new Error(
      `postcodes.io request failed (${response.status} ${response.statusText})`,
    )
  }

  const body = (await response.json()) as {
    result?: { postcode?: string; longitude?: number; latitude?: number }
  }

  if (
    !body.result ||
    typeof body.result.longitude !== 'number' ||
    typeof body.result.latitude !== 'number'
  ) {
    throw new Error('postcodes.io returned an unexpected payload')
  }

  return {
    postcode: body.result.postcode ?? postcode,
    longitude: body.result.longitude,
    latitude: body.result.latitude,
  }
}
