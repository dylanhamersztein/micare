// `search` deep module — postcode + radius → ordered, visible Practitioners.
//
// Hides four concerns behind a single function:
//   1. postcodes.io geocoding (via src/server/geocode)
//   2. PostGIS ST_DWithin radius query
//   3. visibility filtering via src/visibility
//   4. distance ordering (and the distance exposed in miles to the caller)
//
// `searchPractitioners` is the public deep-module entry point — used by
// integration tests and (via the `search` server function) by the route
// loader.

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  isVisible,
  type SubscriptionStatus,
  type VerificationStatus,
} from '../visibility'
import { db } from './db'
import { geocodePostcode } from './geocode'

const METERS_PER_MILE = 1609.344

export const ALLOWED_RADII_MILES = [5, 10, 15] as const
export type AllowedRadiusMiles = (typeof ALLOWED_RADII_MILES)[number]

const inputSchema = z.object({
  postcode: z.string().min(1),
  radiusMiles: z.union([z.literal(5), z.literal(10), z.literal(15)]),
})

export type SearchInput = z.infer<typeof inputSchema>

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

type PractitionerRow = {
  id: string
  short_id: string
  full_name: string
  practice_name: string | null
  practice_address_line1: string | null
  practice_postcode: string | null
  practice_town: string | null
  booking_link_url: string | null
  accepting_new_patients: boolean
  verification_status: VerificationStatus
  subscription_status: SubscriptionStatus
  distance_meters: number | string
}

function hasMinFields(row: PractitionerRow): boolean {
  return Boolean(
    row.full_name &&
      row.practice_name &&
      row.practice_address_line1 &&
      row.practice_postcode &&
      row.booking_link_url,
  )
}

export async function searchPractitioners(
  input: SearchInput,
): Promise<Array<SearchResult>> {
  const { postcode, radiusMiles } = inputSchema.parse(input)
  const point = await geocodePostcode(postcode)
  const radiusMeters = radiusMiles * METERS_PER_MILE

  const result = await db.query<PractitionerRow>(
    `select
       id,
       short_id,
       full_name,
       practice_name,
       practice_address_line1,
       practice_postcode,
       practice_town,
       booking_link_url,
       accepting_new_patients,
       verification_status,
       subscription_status,
       extensions.st_distance(
         practice_point,
         extensions.st_setsrid(extensions.st_makepoint($1, $2), 4326)::extensions.geography
       ) as distance_meters
     from public.practitioners
     where practice_point is not null
       and extensions.st_dwithin(
         practice_point,
         extensions.st_setsrid(extensions.st_makepoint($1, $2), 4326)::extensions.geography,
         $3
       )
     order by distance_meters asc`,
    [point.longitude, point.latitude, radiusMeters],
  )

  return result.rows
    .filter((row) =>
      isVisible({
        verificationStatus: row.verification_status,
        subscriptionStatus: row.subscription_status,
        minFieldsFilled: hasMinFields(row),
      }),
    )
    .map((row) => ({
      id: row.id,
      shortId: row.short_id,
      fullName: row.full_name,
      practiceName: row.practice_name,
      practiceAddressLine1: row.practice_address_line1,
      practicePostcode: row.practice_postcode,
      practiceTown: row.practice_town,
      bookingLinkUrl: row.booking_link_url,
      acceptingNewPatients: row.accepting_new_patients,
      distanceMiles: Number(row.distance_meters) / METERS_PER_MILE,
    }))
}

export const search = createServerFn({ method: 'GET' })
  .inputValidator((raw: unknown) => inputSchema.parse(raw))
  .handler(({ data }) => searchPractitioners(data))
