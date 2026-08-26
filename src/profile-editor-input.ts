// Pure inputs for the profile editor. Kept free of server-only imports so the
// route component can import it without dragging the database client into the
// browser bundle. Matches the pattern of src/signup-input.ts.

import { z } from 'zod'

const UK_POSTCODE_PATTERN = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i

function formatUkPostcode(raw: string): string {
  const collapsed = raw.trim().toUpperCase().replace(/\s+/g, '')
  if (collapsed.length < 5) return collapsed
  return `${collapsed.slice(0, collapsed.length - 3)} ${collapsed.slice(-3)}`
}

const openingHoursSchema = z
  .record(z.string(), z.string().trim().min(1))
  .nullable()

/**
 * The character limits the schema enforces. Named here rather than typed into
 * each `.max()` so the editor's help text can state the same number it will be
 * held to — a limit stated wrong is worse than a limit left unstated.
 */
export const PROFILE_FIELD_LIMITS = {
  practiceName: 120,
  practiceAddressLine1: 200,
  practiceAddressLine2: 200,
  practiceAddressLine3: 200,
  practiceTown: 120,
  bio: 1000,
  accessibilityNotes: 500,
} as const

export const profileEditorInputSchema = z
  .object({
    practiceName: z
      .string()
      .trim()
      .min(1, 'Practice name is required')
      .max(PROFILE_FIELD_LIMITS.practiceName),
    practiceAddressLine1: z
      .string()
      .trim()
      .min(1, 'Address line 1 is required')
      .max(PROFILE_FIELD_LIMITS.practiceAddressLine1),
    practiceAddressLine2: z
      .string()
      .trim()
      .max(PROFILE_FIELD_LIMITS.practiceAddressLine2)
      .nullable(),
    practiceAddressLine3: z
      .string()
      .trim()
      .max(PROFILE_FIELD_LIMITS.practiceAddressLine3)
      .nullable(),
    practicePostcode: z
      .string()
      .trim()
      .regex(UK_POSTCODE_PATTERN, 'Enter a valid UK postcode')
      .transform(formatUkPostcode),
    practiceTown: z
      .string()
      .trim()
      .min(1, 'Town is required')
      .max(PROFILE_FIELD_LIMITS.practiceTown),
    bookingLinkUrl: z
      .string()
      .trim()
      .url('Enter a valid booking link URL')
      .refine(
        (value) => value.startsWith('http://') || value.startsWith('https://'),
        'Booking link must start with http:// or https://',
      ),
    openingHours: openingHoursSchema,
    byAppointmentOnly: z.boolean(),
    bio: z.string().trim().max(PROFILE_FIELD_LIMITS.bio).nullable(),
    photoUrl: z
      .string()
      .trim()
      .url()
      .nullable()
      .or(z.literal('').transform(() => null)),
    services: z.array(z.string().trim().min(1)).default([]),
    languages: z.array(z.string().trim().min(1)).default([]),
    accessibilityNotes: z
      .string()
      .trim()
      .max(PROFILE_FIELD_LIMITS.accessibilityNotes)
      .nullable(),
    acceptingNewPatients: z.boolean(),
  })
  .superRefine((value, ctx) => {
    const hasHours =
      value.openingHours !== null &&
      Object.values(value.openingHours).some((h) => h.trim().length > 0)
    if (hasHours === value.byAppointmentOnly) {
      ctx.addIssue({
        code: 'custom',
        path: ['byAppointmentOnly'],
        message:
          'Provide either opening hours or set by-appointment-only — not both, and not neither.',
      })
    }
  })

export type ProfileEditorInput = z.infer<typeof profileEditorInputSchema>
