// Server-only implementation of the `search` deep module. The exported
// `searchPractitioners` is the public deep-module entry point: integration
// tests call it directly, and `src/server/search.ts` wraps it in a thin
// createServerFn shim for the route loader.

import { searchInputSchema } from '../search-input'
import type { SearchInput, SearchResult } from '../search-input'
import { isVisible } from '../visibility'
import type { SubscriptionStatus, VerificationStatus } from '../visibility'
import { db } from './db'
import { geocodeLocation } from './geocode'

const METERS_PER_MILE = 1609.344

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
  const { postcodeOrCity, radiusMiles } = searchInputSchema.parse(input)
  const point = await geocodeLocation(postcodeOrCity)
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
