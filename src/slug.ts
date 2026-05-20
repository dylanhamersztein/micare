// `slug` deep module (pure half). Owns ADR-0005's URL shape:
//   /p/<short_id>/<auto_slug>
// where short_id is the canonical, immutable identifier and the slug is a
// system-generated, decorative, regenerate-on-change string. Nothing here
// touches the database or the network, so the route component can import
// these types and helpers without dragging server code into the browser
// bundle. The DB-backed resolver lives in src/server/profile-impl.ts.

type SluggableProfile = {
  fullName: string
  practiceName: string | null
  practiceTown: string | null
}

// Kebab-cases arbitrary text: strips diacritics, lowercases, and collapses
// every run of non-alphanumeric characters into a single hyphen. Handles the
// accented / multi-word / hyphenated names called out in ADR-0005.
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ADR-0005: the slug is the kebab-cased `name practice town`. Null Practice
// fields are dropped so the slug never contains empty segments.
export function generateProfileSlug(profile: SluggableProfile): string {
  return slugify(
    [profile.fullName, profile.practiceName, profile.practiceTown]
      .filter((part): part is string => Boolean(part))
      .join(' '),
  )
}

export function generateProfileUrl(
  profile: SluggableProfile & { shortId: string },
): string {
  return `/p/${profile.shortId}/${generateProfileSlug(profile)}`
}

// base62 alphabet for short_id allocation. short_id is deliberately distinct
// from the practitioners table's uuid primary key (ADR-0005): it is the
// canonical, link-stable identifier exposed in URLs. The signup slice will
// retry on collision against the DB unique constraint; this is the generator.
const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export function generateShortId(length = 8): string {
  // Reject bytes >= 248 (the largest multiple of 62 <= 256) so that
  // `byte % 62` maps every base62 character with equal probability.
  const LIMIT = 248
  let id = ''
  while (id.length < length) {
    const byte = crypto.getRandomValues(new Uint8Array(1))[0]
    if (byte < LIMIT) id += BASE62[byte % 62]
  }
  return id
}
