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

export const profileEditorInputSchema = z
  .object({
    practiceName: z.string().trim().min(1, 'Practice name is required').max(120),
    practiceAddressLine1: z
      .string()
      .trim()
      .min(1, 'Address line 1 is required')
      .max(200),
    practiceAddressLine2: z.string().trim().max(200).nullable(),
    practiceAddressLine3: z.string().trim().max(200).nullable(),
    practicePostcode: z
      .string()
      .trim()
      .regex(UK_POSTCODE_PATTERN, 'Enter a valid UK postcode')
      .transform(formatUkPostcode),
    practiceTown: z.string().trim().min(1, 'Town is required').max(120),
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
    bio: z.string().trim().max(1000).nullable(),
    photoUrl: z.string().trim().url().nullable().or(z.literal('').transform(() => null)),
    services: z.array(z.string().trim().min(1)).default([]),
    languages: z.array(z.string().trim().min(1)).default([]),
    accessibilityNotes: z.string().trim().max(500).nullable(),
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
