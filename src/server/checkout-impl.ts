// Server-only implementation of the `checkout` orchestrator. Turns a
// verified-prospect SignupInput into a paying Practitioner: re-verifies via
// the 24h cache (so a client cannot skip verification by calling this
// directly), inserts the practitioners row with the small set of fields
// signup supplies, back-fills the matching verifications.practitioner_id,
// then EITHER (mock) synthesises stripe IDs and flips subscription_status
// to active, OR (real) creates a Stripe Customer and Checkout Session and
// returns its url. Integration tests call startCheckoutImpl directly;
// src/server/checkout.ts wraps it in a thin createServerFn shim.

import { env } from '../env.server'
import type { SignupInput } from '../signup-input'
import { generateShortId } from '../slug'
import { verify } from './verification-impl'
import { db } from './db'

export type StartCheckoutResult =
  | { kind: 'stripe'; checkoutUrl: string }
  | { kind: 'mock'; redirectTo: string }

const MAX_SHORT_ID_ATTEMPTS = 5
const PROFILE_EDITOR_PATH = '/practitioner/profile-editor'

async function insertPractitioner(args: {
  input: SignupInput
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  subscriptionStatus: 'incomplete' | 'active'
}): Promise<{ id: string; shortId: string }> {
  for (let attempt = 1; attempt <= MAX_SHORT_ID_ATTEMPTS; attempt++) {
    const shortId = generateShortId()
    try {
      const result = await db.query<{ id: string; short_id: string }>(
        `insert into public.practitioners (
           short_id, full_name, goc_number, profession_code, email,
           verification_status, last_verified_at,
           subscription_status, stripe_customer_id, stripe_subscription_id
         ) values (
           $1, $2, $3, $4, $5,
           'verified', now(),
           $6, $7, $8
         )
         returning id, short_id`,
        [
          shortId,
          args.input.fullName,
          args.input.gocNumber,
          args.input.professionCode,
          args.input.email,
          args.subscriptionStatus,
          args.stripeCustomerId,
          args.stripeSubscriptionId,
        ],
      )
      return { id: result.rows[0].id, shortId: result.rows[0].short_id }
    } catch (error) {
      // 23505 = unique_violation. Retry on short_id collisions only.
      const code = (error as { code?: string }).code
      const detail = (error as { detail?: string }).detail ?? ''
      if (code === '23505' && detail.includes('short_id')) continue
      throw error
    }
  }
  throw new Error('Failed to allocate a unique short_id after retries')
}

async function backfillVerificationPractitionerId(
  gocNumber: string,
  practitionerId: string,
): Promise<void> {
  await db.query(
    `update public.verifications
        set practitioner_id = $1
      where goc_number = $2
        and practitioner_id is null`,
    [practitionerId, gocNumber],
  )
}

export async function startCheckoutImpl(
  data: SignupInput,
): Promise<StartCheckoutResult> {
  const verification = await verify(
    data.professionCode,
    data.fullName,
    data.gocNumber,
  )
  if (verification.kind !== 'found-active') {
    throw new Error(
      `Cannot start checkout: GOC ${data.gocNumber} is not verified (${verification.kind})`,
    )
  }

  if (env.VITE_STRIPE_MOCK) {
    const customerId = `cus_mock_${generateShortId(12)}`
    const subscriptionId = `sub_mock_${generateShortId(12)}`
    const practitioner = await insertPractitioner({
      input: data,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      subscriptionStatus: 'active',
    })
    await backfillVerificationPractitionerId(data.gocNumber, practitioner.id)
    return {
      kind: 'mock',
      redirectTo: `${PROFILE_EDITOR_PATH}?short_id=${practitioner.shortId}`,
    }
  }

  // Real Stripe Checkout path lands in Task 6.
  throw new Error('Stripe checkout path not yet implemented')
}
