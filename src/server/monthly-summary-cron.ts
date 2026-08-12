// Monthly summary email (issue #15). Runs daily and emails every Practitioner
// whose renewal lands tomorrow the click-through count for the cycle that is
// about to complete — the "see the value before you renew" nudge.

import type { BillingCycle } from '../billing-cycle'
import { env } from '../env.server'
import { formatMonthlySummaryEmail, renewsTomorrow } from '../monthly-summary'
import { currentBillingPeriod } from './billing-period'
import { countClickthroughs } from './clickthrough-count'
import { cronAuthError } from './cron-auth'
import { db } from './db'
import { sendResendEmail } from './resend'

export type MonthlySummaryRun = {
  candidates: number
  sent: number
}

type CandidateRow = {
  id: string
  full_name: string
  email: string
  stripe_subscription_id: string | null
  created_at: Date
}

// Mirrors the other Resend callers (alert-delivery, revocation-refund): a
// structured log line is always emitted as the durable audit trail, and
// ALERT_MOCK short-circuits the send so the suite and local runs stay offline.
async function deliverSummary(
  row: CandidateRow,
  clickthroughCount: number,
  period: BillingCycle,
): Promise<void> {
  const email = formatMonthlySummaryEmail({
    fullName: row.full_name,
    clickthroughCount,
    cycleStart: period.start,
    cycleEnd: period.end,
  })
  console.log(
    '[cron:monthly-summary]',
    JSON.stringify({
      to: row.email,
      clickthroughCount,
      periodEnd: period.end.toISOString(),
    }),
  )
  if (env.ALERT_MOCK) return
  await sendResendEmail({
    from: 'MiCare <noreply@micare.co.uk>',
    to: row.email,
    subject: email.subject,
    text: email.text,
  })
}

export async function runMonthlySummaries(
  now: Date = new Date(),
): Promise<MonthlySummaryRun> {
  const { rows } = await db.query<CandidateRow>(
    `select id, full_name, email, stripe_subscription_id, created_at
       from public.practitioners
      where subscription_status in ('active', 'trialing', 'past_due')`,
  )

  const run: MonthlySummaryRun = { candidates: rows.length, sent: 0 }

  for (const row of rows) {
    const period = await currentBillingPeriod(
      {
        stripeSubscriptionId: row.stripe_subscription_id,
        createdAt: row.created_at,
      },
      now,
    )
    if (!renewsTomorrow(period.end, now)) continue

    const clickthroughCount = await countClickthroughs(row.id, period)

    // Record-first (ADR-0008): the ledger write is the dedup gate, so a
    // replayed run for the same renewal sends nothing.
    const recorded = await db.query(
      `insert into public.monthly_summaries
         (practitioner_id, period_end, clickthrough_count)
       values ($1, $2, $3)
       on conflict (practitioner_id, period_end) do nothing`,
      [row.id, period.end, clickthroughCount],
    )
    if (recorded.rowCount === 0) continue

    await deliverSummary(row, clickthroughCount, period)
    run.sent++
  }

  return run
}

export async function handleMonthlySummaryCron(
  request: Request,
): Promise<Response> {
  const authError = cronAuthError(request, env.CRON_SECRET)
  if (authError) return authError

  const run = await runMonthlySummaries()
  // Structured per-run summary — the audit trail in Vercel logs.
  console.log('[cron:monthly-summary]', JSON.stringify(run))
  return Response.json(run)
}
