// The one place MiCare turns raw `clickthroughs` rows into the number a
// Practitioner is shown. Clicks are written append-only (ADR-0009) and
// aggregated at read time, by exactly two readers — the dashboard
// (dashboard-impl.ts) and the monthly summary email (monthly-summary-cron.ts).
// Both must agree on the window arithmetic, so it lives here: half-open
// [start, end), which puts a click at the renewal instant in the next cycle
// rather than counting it twice.

import type { BillingCycle } from '../billing-cycle'
import { db } from './db'

export async function countClickthroughs(
  practitionerId: string,
  cycle: BillingCycle,
): Promise<number> {
  const { rows } = await db.query<{ count: number }>(
    `select count(*)::int as count
       from public.clickthroughs
      where practitioner_id = $1
        and occurred_at >= $2
        and occurred_at < $3`,
    [practitionerId, cycle.start, cycle.end],
  )
  return rows[0]?.count ?? 0
}
