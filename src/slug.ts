// `slug` deep module (pure half). Owns ADR-0005's URL shape:
//   /p/<short_id>/<auto_slug>
// where short_id is the canonical, immutable identifier and the slug is a
// system-generated, decorative, regenerate-on-change string. Nothing here
// touches the database or the network, so the route component can import
// these types and helpers without dragging server code into the browser
// bundle. The DB-backed resolver lives in src/server/profile-impl.ts.

import { hasMinFields, isVisible } from './visibility'
import type { SubscriptionStatus, VerificationStatus } from './visibility'

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

export type OpeningHours = Record<string, string>

// A Practitioner row reshaped into camelCase, carrying every field the
// resolver and the profile page need. Built by src/server/profile-impl.ts.
export type ProfileRecord = {
  shortId: string
  fullName: string
  photoUrl: string | null
  bio: string | null
  services: Array<string> | null
  languages: Array<string> | null
  accessibilityNotes: string | null
  acceptingNewPatients: boolean
  practiceName: string | null
  practiceAddressLine1: string | null
  practiceAddressLine2: string | null
  practiceAddressLine3: string | null
  practicePostcode: string | null
  practiceTown: string | null
  openingHours: OpeningHours | null
  byAppointmentOnly: boolean
  bookingLinkUrl: string | null
  verificationStatus: VerificationStatus
  subscriptionStatus: SubscriptionStatus
}

// What the public profile page renders: a ProfileRecord minus the internal
// verification/subscription status, plus the canonical slug. Array fields are
// normalised to non-null so the component never branches on null.
export type PublicProfile = {
  shortId: string
  slug: string
  fullName: string
  photoUrl: string | null
  bio: string | null
  services: Array<string>
  languages: Array<string>
  accessibilityNotes: string | null
  acceptingNewPatients: boolean
  practiceName: string | null
  practiceAddressLine1: string | null
  practiceAddressLine2: string | null
  practiceAddressLine3: string | null
  practicePostcode: string | null
  practiceTown: string | null
  openingHours: OpeningHours | null
  byAppointmentOnly: boolean
  bookingLinkUrl: string | null
}

export type ProfileResolution =
  | { kind: 'canonical'; profile: PublicProfile }
  | { kind: 'stale'; canonicalUrl: string }
  | { kind: 'not-visible' }
  | { kind: 'unknown' }

function toPublicProfile(record: ProfileRecord, slug: string): PublicProfile {
  return {
    shortId: record.shortId,
    slug,
    fullName: record.fullName,
    photoUrl: record.photoUrl,
    bio: record.bio,
    services: record.services ?? [],
    languages: record.languages ?? [],
    accessibilityNotes: record.accessibilityNotes,
    acceptingNewPatients: record.acceptingNewPatients,
    practiceName: record.practiceName,
    practiceAddressLine1: record.practiceAddressLine1,
    practiceAddressLine2: record.practiceAddressLine2,
    practiceAddressLine3: record.practiceAddressLine3,
    practicePostcode: record.practicePostcode,
    practiceTown: record.practiceTown,
    openingHours: record.openingHours,
    byAppointmentOnly: record.byAppointmentOnly,
    bookingLinkUrl: record.bookingLinkUrl,
  }
}

// Pure resolution core for /p/<short_id>/<slug>. Given a Practitioner record
// (or null when the short_id is unknown) and the slug from the URL, returns
// the outcome the route loader acts on. Evaluation order is deliberate:
// unknown short_id, then visibility (ADR-0002 + ADR-0004), then stale-slug
// (ADR-0005) — there is no point redirecting toward a hidden profile.
export function resolveProfile(
  record: ProfileRecord | null,
  requestedSlug: string,
): ProfileResolution {
  if (!record) {
    return { kind: 'unknown' }
  }

  const visible = isVisible({
    verificationStatus: record.verificationStatus,
    subscriptionStatus: record.subscriptionStatus,
    minFieldsFilled: hasMinFields({
      fullName: record.fullName,
      practiceName: record.practiceName,
      practiceAddressLine1: record.practiceAddressLine1,
      practicePostcode: record.practicePostcode,
      bookingLinkUrl: record.bookingLinkUrl,
    }),
  })
  if (!visible) {
    return { kind: 'not-visible' }
  }

  const canonicalSlug = generateProfileSlug(record)
  if (requestedSlug !== canonicalSlug) {
    return {
      kind: 'stale',
      canonicalUrl: `/p/${record.shortId}/${canonicalSlug}`,
    }
  }

  return { kind: 'canonical', profile: toPublicProfile(record, canonicalSlug) }
}
