// Server-only write path for the profile editor, and the place the
// visibility flip described in AC #4 + #7 of issue #11 is observed. Nothing
// stores that flip: visibility is recomputed from the saved row by
// isVisible() (ADR-0024), and this module only reports the answer back to
// the editor and uses it to fire the Notify-Me hook.
//
// Keyed on the login email the sealed session carries (ADR-0006) — never on
// short_id, which is public in every /p/<short_id>/<slug> URL and so names
// whoever the caller pleases.

import type { z } from 'zod'

import { profileEditorInputSchema } from '../profile-editor-input'
import type { ProfileEditorInput } from '../profile-editor-input'
import { hasMinFields, isVisible } from '../visibility'
import type { SubscriptionStatus, VerificationStatus } from '../visibility'
import { db } from './db'
import { PostcodeNotFoundError, geocodePostcode } from './geocode'
import { onPractitionerBecameVisible } from './notify-fire'

export type ProfileUpdateResult =
  | { kind: 'saved'; visible: boolean }
  | { kind: 'invalid'; fieldErrors: Record<string, string> }
  | { kind: 'postcode-not-found' }
  | { kind: 'unknown' }

function flattenFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form'
    if (!(key in out)) out[key] = issue.message
  }
  return out
}

export async function updateProfile(
  email: string,
  rawInput: unknown,
): Promise<ProfileUpdateResult> {
  const parsed = profileEditorInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { kind: 'invalid', fieldErrors: flattenFieldErrors(parsed.error) }
  }
  const input: ProfileEditorInput = parsed.data

  let point: { longitude: number; latitude: number }
  try {
    const geocoded = await geocodePostcode(input.practicePostcode)
    point = { longitude: geocoded.longitude, latitude: geocoded.latitude }
  } catch (error) {
    if (error instanceof PostcodeNotFoundError) {
      return { kind: 'postcode-not-found' }
    }
    throw error
  }

  const result = await db.query<{
    id: string
    verification_status: VerificationStatus
    subscription_status: SubscriptionStatus
    full_name: string
  }>(
    `update public.practitioners
        set practice_name           = $2,
            practice_address_line1  = $3,
            practice_address_line2  = $4,
            practice_address_line3  = $5,
            practice_postcode       = $6,
            practice_town           = $7,
            practice_point          = extensions.st_setsrid(
              extensions.st_makepoint($8, $9), 4326
            )::extensions.geography,
            opening_hours           = $10::jsonb,
            by_appointment_only     = $11,
            booking_link_url        = $12,
            bio                     = $13,
            photo_url               = $14,
            services                = $15,
            languages               = $16,
            accessibility_notes     = $17,
            accepting_new_patients  = $18,
            updated_at              = now()
      where lower(email) = lower($1)
      returning id, verification_status, subscription_status, full_name`,
    [
      email.trim(),
      input.practiceName,
      input.practiceAddressLine1,
      input.practiceAddressLine2,
      input.practiceAddressLine3,
      input.practicePostcode,
      input.practiceTown,
      point.longitude,
      point.latitude,
      input.openingHours === null ? null : JSON.stringify(input.openingHours),
      input.byAppointmentOnly,
      input.bookingLinkUrl,
      input.bio,
      input.photoUrl,
      input.services,
      input.languages,
      input.accessibilityNotes,
      input.acceptingNewPatients,
    ],
  )

  const row = result.rows.at(0)
  if (!row) {
    return { kind: 'unknown' }
  }

  const visible = isVisible({
    verificationStatus: row.verification_status,
    subscriptionStatus: row.subscription_status,
    minFieldsFilled: hasMinFields({
      fullName: row.full_name,
      practiceName: input.practiceName,
      practiceAddressLine1: input.practiceAddressLine1,
      practicePostcode: input.practicePostcode,
      bookingLinkUrl: input.bookingLinkUrl,
    }),
  })

  // The "Practitioner becomes visible" moment (issue #18). The hook is
  // fire-once by its own ledger, so calling it on every visible save is safe;
  // this path only has to know when visibility is true.
  //
  // Never let a Notify-Me failure fail a save that has already committed: the
  // Practitioner would see an error on work that was in fact written. The
  // trade-off is that mail lost to a Resend outage is not retried — the
  // ledger row is already down.
  if (visible) {
    try {
      await onPractitionerBecameVisible(row.id)
    } catch (error) {
      console.error('[notify-me:fire] failed', row.id, error)
    }
  }

  return { kind: 'saved', visible }
}
