// Shared UK postcode vocabulary. Two callers need the same notion of "is this
// a full postcode, and what is its canonical spelling?": src/server/geocode.ts
// (to decide between the postcode and place lookups) and src/notify-input.ts
// (to reject a partial postcode outright, since a Notify-Me row must geocode
// to a point). Pure — no fetch, no env — so both the client bundle and the
// server can import it.

// Matches a full UK postcode, with or without internal whitespace. Outward
// codes alone (e.g. "EC2V") are intentionally not matched: /search falls those
// through to the place lookup, which postcodes.io also resolves.
const UK_POSTCODE_PATTERN = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i

export function isFullUkPostcode(raw: string): boolean {
  return UK_POSTCODE_PATTERN.test(raw.trim())
}

export function formatUkPostcode(raw: string): string {
  const collapsed = raw.trim().toUpperCase().replace(/\s+/g, '')
  if (collapsed.length < 5) return collapsed
  return `${collapsed.slice(0, collapsed.length - 3)} ${collapsed.slice(-3)}`
}
