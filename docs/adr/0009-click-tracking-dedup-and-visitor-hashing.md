# ADR-0009: Click tracking deduplicates on a salted visitor hash

- Status: accepted
- Date: 2026-08-12
- Slice: 5 (Booking Link click tracking)

## Context

The Booking Link is the sole conversion action on a Practitioner profile in
Phase 1, and the click-through count is one of the six readouts on the
Practitioner dashboard (Slice 10). That count is the main evidence a
Practitioner has that their £29/month is doing something, so it has to mean
"people who wanted to book with me" rather than "page loads".

Two problems follow from that:

1. A consumer who clicks Book, comes back, and clicks again should count once.
   Refreshes, back-button returns and double-clicks otherwise inflate the
   number in a way the Practitioner cannot distinguish from real demand.
2. Identifying the repeat visitor means retaining something about them. MiCare
   has no consumer accounts, so the only signals available are the IP address
   and user agent — both personal data under UK GDPR.

## Decision

**Deduplicate on `(practitioner_id, hashed_visitor)` over a rolling 24-hour
window.** The first click in the window writes a row to `clickthroughs`;
subsequent clicks from the same visitor to the same Practitioner redirect
normally but write nothing. The window is per Practitioner, so one consumer
comparing three opticians registers a click for each.

**Store a salted SHA-256 of `ip + user agent`, never the raw values.** The
salt comes from `CLICK_TRACKING_SALT` (optional; local dev falls back to a
fixed constant). Without a salt the stored hash is reversible by brute force —
the IPv4 address space is 2^32 — which would make the event log a de-facto
list of visitor IP addresses.

**Write append-only; aggregate at read time.** `clickthroughs` is an event log
with no counters updated at write time. `src/server/dashboard-impl.ts` counts
rows inside the current billing cycle when the dashboard loads.

**Only record and follow clicks for a publicly visible Practitioner.** `/go`
applies the same ADR-0002 / ADR-0004 gate as the public profile, so a revoked
or lapsed listing stops redirecting the moment it stops being listed.

## Consequences

- The count is "distinct visitor-days", not raw clicks. This is the number
  worth showing a Practitioner, but it is not comparable to a raw analytics
  click count, and the monthly summary email (Slice 14) must describe it in
  those terms.
- Visitors behind a shared NAT with identical user agents collapse into one
  visitor for 24h, undercounting. Accepted: undercounting a genuine consumer is
  a smaller harm than overstating demand to a paying Practitioner.
- The dedup check and insert are one `insert ... where not exists` statement,
  so a refresh cannot slip a second row in between them. Two genuinely
  simultaneous requests can still both pass the check under `read committed`
  and write two rows. Accepted: a unique index would be the alternative, but it
  would also permanently pin the dedup window to exactly the stored row, and a
  duplicate on a true double-click is a rounding error on a monthly count.
- Rotating `CLICK_TRACKING_SALT` resets every in-flight dedup window — the next
  click from every visitor counts as new. Rotate deliberately, not on a
  schedule.
- Hashes are not reversible, so a subject-access or erasure request cannot be
  served by looking up a consumer's rows. This is intentional: the log holds no
  data that can be tied back to an identifiable person without the salt.

## Alternatives considered

- **A cookie-based visitor id.** More accurate across IP changes, but it puts a
  tracking cookie on a health-adjacent site and drags in consent-banner
  obligations for a metric that does not need them.
- **Counting every click with no dedup.** Simpler, and the raw number is the
  honest count of redirects — but it rewards refreshing and would make the
  dashboard figure easy to inflate accidentally.
- **A unique index on `(practitioner_id, hashed_visitor, day)`.** Would make
  the dedup airtight, but it buckets by calendar day rather than a rolling
  window, so two clicks 10 minutes apart either side of midnight count twice.
