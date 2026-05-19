// Pure inputs and outputs for the `search` deep module. Kept free of
// server-only imports so the route component can read constants and types
// without dragging the database client into the browser bundle.

import { z } from 'zod'

export const ALLOWED_RADII_MILES = [5, 10, 15] as const
export type AllowedRadiusMiles = (typeof ALLOWED_RADII_MILES)[number]

export const searchInputSchema = z.object({
  postcodeOrCity: z.string().trim().min(1),
  radiusMiles: z.union([z.literal(5), z.literal(10), z.literal(15)]),
})

export type SearchInput = z.infer<typeof searchInputSchema>

export type SearchResult = {
  id: string
  shortId: string
  fullName: string
  practiceName: string | null
  practiceAddressLine1: string | null
  practicePostcode: string | null
  practiceTown: string | null
  bookingLinkUrl: string | null
  acceptingNewPatients: boolean
  distanceMiles: number
}
