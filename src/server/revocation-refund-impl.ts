// Refund-on-revocation handler (issue #17 / #69, ADR-0004 / ADR-0008 /
// ADR-0029). Invoked by the weekly re-verification cron the moment a
// Practitioner transitions to verification_status = 'revoked'. Cancels the
// Stripe subscription, refunds the unused portion of the period they had
// already paid for, and emails the Practitioner what was actually done.
//
// The refund is a real refunds.create against the card, NOT the proration
// credit that `subscriptions.cancel({ prorate: true })` produces: a credit on
// a customer who by definition has no future invoice is money that never comes
// back (issue #69). So the cancel is deliberately un-prorated and the refund is
// the only money movement.
//
// Idempotent via the public.revocation_refunds ledger (mirrors
// public.stripe_events): the first DB write records the practitioner_id, and a
// replay finds it already present and returns { kind: 'duplicate' } before any
// side effect — no double cancellation, no double refund, no duplicate email.
//
// Record-first trade-off (ADR-0008): the ledger row is written BEFORE the
// Stripe calls, so a failure part-way through is not retried. The row is
// written as 'pending' and settled to its real outcome afterwards, which turns
// that trade-off into something an operator can find —
// `select * from public.revocation_refunds where outcome = 'pending'` is the
// list of revocations whose money needs a human.
//
// Terminal subscriptions (canceled/unpaid) or a missing stripe_subscription_id
// take the no-Stripe path and an email that says the Practitioner was already
// not being billed.

import { currentBillingCycle } from '../billing-cycle'
import { env } from '../env.server'
import { unusedPortionPence } from '../refund-amount'
import { formatRevocationEmail } from '../revocation-notice'
import type { BillingCycle } from '../billing-cycle'
import type { RevocationRefund } from '../revocation-notice'
import { db } from './db'
import { sendResendEmail } from './resend'
import { getStripe } from './stripe'
import type Stripe from 'stripe'

export type RevocationRefundOutcome =
  | { kind: 'duplicate' }
  | { kind: 'refunded'; pence: number }
  | { kind: 'nothing-to-refund' }
  | { kind: 'already-terminal' }

/** What the refund step can conclude once there is a subscription to cancel. */
type SettledRefund = Extract<
  RevocationRefund,
  { kind: 'refunded' } | { kind: 'nothing-to-refund' }
>

type RefundRow = {
  email: string
  full_name: string
  subscription_status: string
  stripe_subscription_id: string | null
  created_at: Date
}

const TERMINAL_STATUSES = new Set(['canceled', 'unpaid'])

// Under VITE_STRIPE_MOCK there is no invoice to read, so the unused portion is
// derived from the local billing cycle and the one price Phase 1 sells — the
// same local-fallback idiom ADR-0011 uses for the billing period. Nothing here
// runs against real money.
const MOCK_MONTHLY_PENCE = 2900

async function loadPractitioner(practitionerId: string): Promise<RefundRow> {
  const { rows } = await db.query<RefundRow>(
    `select email, full_name, subscription_status, stripe_subscription_id,
            created_at
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
): Promise<'recorded' | 'duplicate'> {
  const result = await db.query<{ practitioner_id: string }>(
    `insert into public.revocation_refunds (practitioner_id, outcome)
     values ($1, 'pending')
     on conflict (practitioner_id) do nothing
     returning practitioner_id`,
    [practitionerId],
  )
  return result.rowCount === 0 ? 'duplicate' : 'recorded'
}

async function settle(
  practitionerId: string,
  outcome: 'refunded' | 'nothing-to-refund' | 'already-terminal',
  refundedPence: number | null,
): Promise<void> {
  await db.query(
    `update public.revocation_refunds
        set outcome = $2, refunded_pence = $3
      where practitioner_id = $1`,
    [practitionerId, outcome, refundedPence],
  )
}

/**
 * The window the invoice actually bought. The line item's period is the
 * service period; the invoice's own period_start/period_end describe when
 * items accrued onto it, which is only the same thing for a plain
 * one-line subscription renewal — so the line wins where there is one.
 */
function servicePeriod(invoice: Stripe.Invoice): BillingCycle {
  const line = invoice.lines.data.at(-1)
  return {
    start: new Date((line?.period.start ?? invoice.period_start) * 1000),
    end: new Date((line?.period.end ?? invoice.period_end) * 1000),
  }
}

/** The PaymentIntent that settled the invoice, if it was paid by one. */
function paidPaymentIntent(invoice: Stripe.Invoice): string | null {
  const payment = invoice.payments?.data.find((p) => p.status === 'paid')
  const intent = payment?.payment.payment_intent
  if (!intent) return null
  return typeof intent === 'string' ? intent : intent.id
}

async function refundUnusedPortion(
  subscriptionId: string,
  anchor: Date,
  now: Date,
): Promise<SettledRefund> {
  if (env.VITE_STRIPE_MOCK) {
    const pence = unusedPortionPence({
      amountPaidPence: MOCK_MONTHLY_PENCE,
      period: currentBillingCycle(anchor, now),
      now,
    })
    return pence > 0
      ? { kind: 'refunded', pence }
      : { kind: 'nothing-to-refund' }
  }

  const stripe = getStripe()
  const invoices = await stripe.invoices.list({
    subscription: subscriptionId,
    status: 'paid',
    limit: 1,
    expand: ['data.payments'],
  })
  const invoice = invoices.data.at(0)
  if (!invoice) return { kind: 'nothing-to-refund' }

  const paymentIntent = paidPaymentIntent(invoice)
  if (!paymentIntent) return { kind: 'nothing-to-refund' }

  const pence = unusedPortionPence({
    amountPaidPence: invoice.amount_paid,
    period: servicePeriod(invoice),
    now,
  })
  // An amount-less refunds.create refunds the WHOLE charge, so a zero unused
  // portion has to short-circuit rather than fall through to Stripe.
  if (pence <= 0) return { kind: 'nothing-to-refund' }

  await stripe.refunds.create({
    payment_intent: paymentIntent,
    amount: pence,
    reason: 'requested_by_customer',
    metadata: { micare_reason: 'goc-registration-revoked' },
  })
  return { kind: 'refunded', pence }
}

async function deliverNotice(
  to: string,
  fullName: string,
  refund: RevocationRefund,
): Promise<void> {
  const email = formatRevocationEmail({ fullName, refund })
  // Structured audit line first — durable in Vercel logs even when mocked.
  console.log(
    '[revocation-refund]',
    JSON.stringify({
      to,
      refund: refund.kind,
      pence: refund.kind === 'refunded' ? refund.pence : null,
      subject: email.subject,
    }),
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

  if ((await recordOrSkip(practitionerId)) === 'duplicate') {
    return { kind: 'duplicate' }
  }

  if (isTerminal) {
    await settle(practitionerId, 'already-terminal', null)
    await deliverNotice(row.email, row.full_name, { kind: 'not-billed' })
    return { kind: 'already-terminal' }
  }

  const subscriptionId = row.stripe_subscription_id!
  if (!env.VITE_STRIPE_MOCK) {
    // No proration: the refund below is the only money movement, and a
    // proration credit on a Practitioner with no future invoice would just
    // sit on their Stripe balance forever (issue #69).
    await getStripe().subscriptions.cancel(subscriptionId, {
      prorate: false,
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

  const refund = await refundUnusedPortion(
    subscriptionId,
    row.created_at,
    new Date(),
  )
  await settle(
    practitionerId,
    refund.kind,
    refund.kind === 'refunded' ? refund.pence : null,
  )
  await deliverNotice(row.email, row.full_name, refund)
  return refund
}
