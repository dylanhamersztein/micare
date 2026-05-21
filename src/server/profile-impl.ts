// Server-only implementation of the public-profile resolver. `resolveProfileUrl`
// is the deep-module entry point: integration tests call it directly, and
// src/server/profile.ts wraps it in a thin createServerFn shim for the route
// loader. The DB-free resolution logic lives in src/slug.ts (`resolveProfile`)
// so every outcome is unit-testable without a database.

import { resolveProfile } from '../slug'
import type { OpeningHours, ProfileRecord, ProfileResolution } from '../slug'
import type { SubscriptionStatus, VerificationStatus } from '../visibility'
import { db } from './db'

type PractitionerProfileRow = {
  short_id: string
  full_name: string
  photo_url: string | null
  bio: string | null
  services: Array<string> | null
  languages: Array<string> | null
  accessibility_notes: string | null
  accepting_new_patients: boolean
  practice_name: string | null
  practice_address_line1: string | null
  practice_address_line2: string | null
  practice_address_line3: string | null
  practice_postcode: string | null
  practice_town: string | null
  opening_hours: OpeningHours | null
  by_appointment_only: boolean
  booking_link_url: string | null
  verification_status: VerificationStatus
  subscription_status: SubscriptionStatus
}

function mapRow(row: PractitionerProfileRow): ProfileRecord {
  return {
    shortId: row.short_id,
    fullName: row.full_name,
    photoUrl: row.photo_url,
    bio: row.bio,
    services: row.services,
    languages: row.languages,
    accessibilityNotes: row.accessibility_notes,
    acceptingNewPatients: row.accepting_new_patients,
    practiceName: row.practice_name,
    practiceAddressLine1: row.practice_address_line1,
    practiceAddressLine2: row.practice_address_line2,
    practiceAddressLine3: row.practice_address_line3,
    practicePostcode: row.practice_postcode,
    practiceTown: row.practice_town,
    openingHours: row.opening_hours,
    byAppointmentOnly: row.by_appointment_only,
    bookingLinkUrl: row.booking_link_url,
    verificationStatus: row.verification_status,
    subscriptionStatus: row.subscription_status,
  }
}

export async function resolveProfileUrl(
  shortId: string,
  requestedSlug: string,
): Promise<ProfileResolution> {
  const result = await db.query<PractitionerProfileRow>(
    `select
       short_id,
       full_name,
       photo_url,
       bio,
       services,
       languages,
       accessibility_notes,
       accepting_new_patients,
       practice_name,
       practice_address_line1,
       practice_address_line2,
       practice_address_line3,
       practice_postcode,
       practice_town,
       opening_hours,
       by_appointment_only,
       booking_link_url,
       verification_status,
       subscription_status
     from public.practitioners
     where short_id = $1`,
    [shortId],
  )

  const row = result.rows[0]
  return resolveProfile(row ? mapRow(row) : null, requestedSlug)
}
