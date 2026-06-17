// Daily stale-verification alert (ADR-0007 / issue #13). Surfaces every
// visible Practitioner whose last_verified_at is older than
// STALE_VERIFICATION_DAYS (or never set) — a signal that the weekly cron or
// the GOC scraper is failing and trust is eroding. Delivery (log + email) is
// owned by alert-delivery.ts.

import { env } from '../env.server'
import type { StalePractitioner } from '../stale-alert'
import { deliverStaleAlert } from './alert-delivery'
import { cronAuthError } from './cron-auth'
import { db } from './db'

export async function findStalePractitioners(
  thresholdDays: number,
): Promise<Array<StalePractitioner>> {
  const { rows } = await db.query<StalePractitioner>(
    `select id, short_id, full_name, last_verified_at
       from public.practitioners
      where visible = true
        and (last_verified_at is null
             or last_verified_at < now() - make_interval(days => $1::int))
      order by last_verified_at asc nulls first`,
    [thresholdDays],
  )
  return rows
}

export async function handleStaleAlertCron(
  request: Request,
): Promise<Response> {
  const authError = cronAuthError(request, env.CRON_SECRET)
  if (authError) return authError

  const stale = await findStalePractitioners(env.STALE_VERIFICATION_DAYS)
  const { channel } = await deliverStaleAlert(stale)
  return Response.json({ staleCount: stale.length, channel })
}
