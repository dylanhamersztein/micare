// Server-only read path for the profile editor. Distinct from the public
// resolver in src/server/profile-impl.ts because the editor needs to load
// rows that are NOT yet visible (a verified+active row with no Practice
// fields is the exact state being edited) and needs the editable columns
// (e.g. `by_appointment_only`) the public resolver hides.

import type { OpeningHours } from '../slug'
import { db } from './db'

export type EditableProfile = {
  shortId: string
  fullName: string
  practiceName: string | null
  practiceAddressLine1: string | null
  practiceAddressLine2: string | null
  practiceAddressLine3: string | null
  practicePostcode: string | null
  practiceTown: string | null
  openingHours: OpeningHours | null
  byAppointmentOnly: boolean
  bookingLinkUrl: string | null
  bio: string | null
  photoUrl: string | null
  services: Array<string>
  languages: Array<string>
  accessibilityNotes: string | null
  acceptingNewPatients: boolean
}

type EditableProfileRow = {
  short_id: string
  full_name: string
  practice_name: string | null
  practice_address_line1: string | null
  practice_address_line2: string | null
  practice_address_line3: string | null
  practice_postcode: string | null
  practice_town: string | null
  opening_hours: OpeningHours | null
  by_appointment_only: boolean
  booking_link_url: string | null
  bio: string | null
  photo_url: string | null
  services: Array<string> | null
  languages: Array<string> | null
  accessibility_notes: string | null
  accepting_new_patients: boolean
}

function mapRow(row: EditableProfileRow): EditableProfile {
  return {
    shortId: row.short_id,
    fullName: row.full_name,
    practiceName: row.practice_name,
    practiceAddressLine1: row.practice_address_line1,
    practiceAddressLine2: row.practice_address_line2,
    practiceAddressLine3: row.practice_address_line3,
    practicePostcode: row.practice_postcode,
    practiceTown: row.practice_town,
    openingHours: row.opening_hours,
    byAppointmentOnly: row.by_appointment_only,
    bookingLinkUrl: row.booking_link_url,
    bio: row.bio,
    photoUrl: row.photo_url,
    services: row.services ?? [],
    languages: row.languages ?? [],
    accessibilityNotes: row.accessibility_notes,
    acceptingNewPatients: row.accepting_new_patients,
  }
}

export async function loadEditableProfile(
  shortId: string,
): Promise<EditableProfile | null> {
  const result = await db.query<EditableProfileRow>(
    `select
       short_id,
       full_name,
       practice_name,
       practice_address_line1,
       practice_address_line2,
       practice_address_line3,
       practice_postcode,
       practice_town,
       opening_hours,
       by_appointment_only,
       booking_link_url,
       bio,
       photo_url,
       services,
       languages,
       accessibility_notes,
       accepting_new_patients
     from public.practitioners
     where short_id = $1`,
    [shortId],
  )
  const row = result.rows.at(0)
  return row ? mapRow(row) : null
}
