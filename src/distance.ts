// PostGIS geography measures in metres; MiCare talks to consumers in miles
// (the search radius selector, the 10-mile Notify-Me catchment). One
// conversion constant, so the two never drift apart.

export const METERS_PER_MILE = 1609.344

export function milesToMeters(miles: number): number {
  return miles * METERS_PER_MILE
}
