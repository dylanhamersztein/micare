// Thin HTTP wrapper around postcodes.io. The `search` deep module owns
// geocoding as an internal collaborator — tests mock this module at the
// `fetch` boundary, never the function itself.
//
// Two resolution paths share a single output shape so callers don't need to
// branch: `geocodePostcode` for UK postcodes, `geocodePlace` for city/town
// names. `geocodeLocation` is the dispatcher used by `searchPractitioners`.

export type GeocodedLocation = {
  label: string
  longitude: number
  latitude: number
}

export class LocationNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LocationNotFoundError'
  }
}

export class PostcodeNotFoundError extends LocationNotFoundError {
  constructor(postcode: string) {
    super(`Postcode not found: ${postcode}`)
    this.name = 'PostcodeNotFoundError'
  }
}

export class PlaceNotFoundError extends LocationNotFoundError {
  constructor(place: string) {
    super(`Place not found: ${place}`)
    this.name = 'PlaceNotFoundError'
  }
}

// Matches a full UK postcode (with or without internal whitespace). Outward
// codes alone (e.g. "EC2V") are intentionally not matched here — they fall
// through to the place lookup, which postcodes.io also resolves.
const UK_POSTCODE_PATTERN = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i

function formatUkPostcode(raw: string): string {
  const collapsed = raw.trim().toUpperCase().replace(/\s+/g, '')
  if (collapsed.length < 5) return collapsed
  return `${collapsed.slice(0, collapsed.length - 3)} ${collapsed.slice(-3)}`
}

function looksLikePostcode(raw: string): boolean {
  return UK_POSTCODE_PATTERN.test(raw.trim())
}

export async function geocodePostcode(raw: string): Promise<GeocodedLocation> {
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
    label: body.result.postcode ?? postcode,
    longitude: body.result.longitude,
    latitude: body.result.latitude,
  }
}

type PlaceRow = {
  name_1?: string
  longitude?: number
  latitude?: number
}

export async function geocodePlace(raw: string): Promise<GeocodedLocation> {
  const query = raw.trim()
  if (!query) {
    throw new Error('geocodePlace requires a non-empty query')
  }

  const url = `https://api.postcodes.io/places?q=${encodeURIComponent(query)}`

  const response = await fetch(url, {
    headers: { accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(
      `postcodes.io request failed (${response.status} ${response.statusText})`,
    )
  }

  const body = (await response.json()) as { result?: Array<PlaceRow> | null }
  const top = body.result?.[0]

  if (
    !top ||
    typeof top.longitude !== 'number' ||
    typeof top.latitude !== 'number'
  ) {
    throw new PlaceNotFoundError(query)
  }

  return {
    label: top.name_1 ?? query,
    longitude: top.longitude,
    latitude: top.latitude,
  }
}

export async function geocodeLocation(raw: string): Promise<GeocodedLocation> {
  return looksLikePostcode(raw) ? geocodePostcode(raw) : geocodePlace(raw)
}
