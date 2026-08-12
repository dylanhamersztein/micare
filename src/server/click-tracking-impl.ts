// Server-only implementation of the click-tracking module. `recordAndRedirect`
// is the deep-module entry point: integration tests call it directly, and
// src/routes/go.tsx turns its result into a 302 or the friendly error page.
//
// The module hides three things from its caller:
//   * the 24h dedup window on (practitioner_id, hashed_visitor),
//   * the append-only write to `clickthroughs` (no aggregation at write time —
//     the dashboard aggregates at read time, see src/server/dashboard-impl.ts),
//   * resolution of the Practitioner's current Booking Link.
//
// A click is only recorded and followed for a Practitioner who is publicly
// visible under ADR-0002 / ADR-0004 — the same gate the public profile applies,
// so a revoked or lapsed listing cannot keep sending traffic through MiCare.

import { DEDUP_WINDOW_MS, extractVisitor, hashVisitor } from '../click-tracking'
import { hasMinFields, isVisible } from '../visibility'
import type { SubscriptionStatus, VerificationStatus } from '../visibility'
import { db } from './db'
import { env } from '../env.server'

// CLICK_TRACKING_SALT is optional (env.server.ts), mirroring AUTH_SESSION_SECRET:
// local/mock runs fall back to a fixed constant so the suite needs no setup.
const DEV_CLICK_SALT = 'micare-dev-insecure-click-salt-change-me'

export type ClickOutcome =
  | { kind: 'redirect'; url: string }
  // Unknown short_id, or a Practitioner who is not publicly visible. Both are
  // "there is no Booking Link for you to follow" from the consumer's side, and
  // both render the same friendly page — we do not leak which one it was.
  | { kind: 'unknown' }

type ClickTargetRow = {
  id: string
  booking_link_url: string | null
  full_name: string
  practice_name: string | null
  practice_address_line1: string | null
  practice_postcode: string | null
  verification_status: VerificationStatus
  subscription_status: SubscriptionStatus
}

export async function recordAndRedirect(
  shortId: string,
  request: Request,
  now: Date = new Date(),
): Promise<ClickOutcome> {
  const result = await db.query<ClickTargetRow>(
    `select
       id,
       booking_link_url,
       full_name,
       practice_name,
       practice_address_line1,
       practice_postcode,
       verification_status,
       subscription_status
     from public.practitioners
     where short_id = $1`,
    [shortId],
  )

  const row = result.rows.at(0)
  if (!row) return { kind: 'unknown' }

  const visible = isVisible({
    verificationStatus: row.verification_status,
    subscriptionStatus: row.subscription_status,
    minFieldsFilled: hasMinFields({
      fullName: row.full_name,
      practiceName: row.practice_name,
      practiceAddressLine1: row.practice_address_line1,
      practicePostcode: row.practice_postcode,
      bookingLinkUrl: row.booking_link_url,
    }),
  })
  // hasMinFields already requires a Booking Link, so a visible row always has
  // one; the null check below is what proves that to the type system.
  if (!visible || !row.booking_link_url) return { kind: 'unknown' }

  const hashedVisitor = hashVisitor(
    extractVisitor(request),
    env.CLICK_TRACKING_SALT ?? DEV_CLICK_SALT,
  )
  const windowStart = new Date(now.getTime() - DEDUP_WINDOW_MS)

  // Insert-where-not-exists keeps the dedup check and the write in one
  // statement, so a refresh cannot slip a second row in between them.
  await db.query(
    `insert into public.clickthroughs (practitioner_id, hashed_visitor, occurred_at)
     select $1, $2, $3
      where not exists (
        select 1
          from public.clickthroughs
         where practitioner_id = $1
           and hashed_visitor = $2
           and occurred_at > $4
      )`,
    [row.id, hashedVisitor, now, windowStart],
  )

  return { kind: 'redirect', url: row.booking_link_url }
}
