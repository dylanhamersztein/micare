// Refund-on-revocation handler (issue #17 / ADR-0004 / ADR-0008). Invoked by
// the weekly re-verification cron the moment a Practitioner transitions to
// verification_status = 'revoked'. Cancels the Stripe subscription with
// proration (so the unused period is refunded) and emails the Practitioner.
//
// Idempotent via the public.revocation_refunds ledger (mirrors
// public.stripe_events): the first DB write records the practitioner_id, and a
// replay finds it already present and returns { kind: 'duplicate' } before any
// side effect — no double cancellation, no duplicate email.
//
// Record-first trade-off (ADR-0008): if the Stripe cancel throws AFTER the
// ledger row is written, a retry is a no-op and the refund is skipped. We
// accept this to guarantee the spec's "no double-cancellation" property; the
// structured log line lets an operator recover the rare failure manually.
//
// Terminal subscriptions (canceled/unpaid) or a missing stripe_subscription_id
// take the no-Stripe path and an email that says the Practitioner was already
// not being billed.

import { env } from '../env.server'
import { formatRevocationEmail } from '../revocation-notice'
import { db } from './db'
import { sendResendEmail } from './resend'
import { getStripe } from './stripe'

export type RevocationRefundOutcome =
  | { kind: 'duplicate' }
  | { kind: 'refunded' }
  | { kind: 'already-terminal' }

type RefundRow = {
  email: string
  full_name: string
  subscription_status: string
  stripe_subscription_id: string | null
}

const TERMINAL_STATUSES = new Set(['canceled', 'unpaid'])

async function loadPractitioner(practitionerId: string): Promise<RefundRow> {
  const { rows } = await db.query<RefundRow>(
    `select email, full_name, subscription_status, stripe_subscription_id
       from public.practitioners
      where id = $1`,
    [practitionerId],
  )
  const row = rows.at(0)
  if (!row) {
    throw new Error(
      `handleRevocationRefund: no practitioner with id ${practitionerId}`,
    )
  }
  return row
}

async function recordOrSkip(
  practitionerId: string,
  outcome: 'refunded' | 'already-terminal',
): Promise<'recorded' | 'duplicate'> {
  const result = await db.query<{ practitioner_id: string }>(
    `insert into public.revocation_refunds (practitioner_id, outcome)
     values ($1, $2)
     on conflict (practitioner_id) do nothing
     returning practitioner_id`,
    [practitionerId, outcome],
  )
  return result.rowCount === 0 ? 'duplicate' : 'recorded'
}

async function deliverNotice(
  to: string,
  fullName: string,
  refunded: boolean,
): Promise<void> {
  const email = formatRevocationEmail({ fullName, refunded })
  // Structured audit line first — durable in Vercel logs even when mocked.
  console.log(
    '[revocation-refund]',
    JSON.stringify({ to, refunded, subject: email.subject }),
  )
  if (env.ALERT_MOCK) return
  await sendResendEmail({
    from: 'MiCare <noreply@micare.co.uk>',
    to,
    subject: email.subject,
    text: email.text,
  })
}

export async function handleRevocationRefund(
  practitionerId: string,
): Promise<RevocationRefundOutcome> {
  const row = await loadPractitioner(practitionerId)
  const isTerminal =
    TERMINAL_STATUSES.has(row.subscription_status) ||
    row.stripe_subscription_id === null

  const dedupe = await recordOrSkip(
    practitionerId,
    isTerminal ? 'already-terminal' : 'refunded',
  )
  if (dedupe === 'duplicate') return { kind: 'duplicate' }

  if (isTerminal) {
    await deliverNotice(row.email, row.full_name, false)
    return { kind: 'already-terminal' }
  }

  if (!env.VITE_STRIPE_MOCK) {
    await getStripe().subscriptions.cancel(row.stripe_subscription_id!, {
      prorate: true,
      invoice_now: true,
      cancellation_details: {
        comment: 'GOC registration revoked — automatic MiCare cancellation',
      },
    })
  }

  await db.query(
    `update public.practitioners
        set subscription_status = 'canceled', updated_at = now()
      where id = $1`,
    [practitionerId],
  )
  await deliverNotice(row.email, row.full_name, true)
  return { kind: 'refunded' }
}
