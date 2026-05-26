// /api/stripe/webhook handler — pulled out of the route file so the
// integration test can drive it with a Request directly. Signature
// verification is delegated to stripe.webhooks.constructEvent, which throws
// on a missing or mismatched signature; the catch returns HTTP 400 so
// Stripe will not retry a fundamentally-broken delivery. Idempotency is
// enforced by the stripe_events ledger: a replay finds its event_id
// already present and returns 200 without re-applying the change.

import { db } from './db'
import { getStripe } from './stripe'
import { env } from '../env.server'
import { mapStripeEvent } from '../subscription-sync'
import type { SubscriptionStateChange } from '../subscription-sync'

async function recordEventOrSkip(
  eventId: string,
  eventType: string,
): Promise<'recorded' | 'duplicate'> {
  const result = await db.query<{ event_id: string }>(
    `insert into public.stripe_events (event_id, event_type)
     values ($1, $2)
     on conflict (event_id) do nothing
     returning event_id`,
    [eventId, eventType],
  )
  return result.rowCount === 0 ? 'duplicate' : 'recorded'
}

async function applyStateChange(
  change: SubscriptionStateChange,
): Promise<void> {
  await db.query(
    `update public.practitioners
        set subscription_status = $1,
            stripe_subscription_id = $2,
            updated_at = now()
      where stripe_customer_id = $3`,
    [
      change.subscriptionStatus,
      change.stripeSubscriptionId,
      change.stripeCustomerId,
    ],
  )
}

export async function handleStripeWebhook(request: Request): Promise<Response> {
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return new Response('Webhook secret not configured', { status: 500 })
  }

  const rawBody = await request.text()
  const stripe = getStripe()

  let event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    )
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  // The naturally-idempotent UPDATE means writing the same state twice is a
  // no-op for the row itself; the ledger guards everything else (logs,
  // future emails, future analytics).
  const dedupe = await recordEventOrSkip(event.id, event.type)
  if (dedupe === 'duplicate') {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  const change = mapStripeEvent(event)
  if (change) {
    await applyStateChange(change)
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}
