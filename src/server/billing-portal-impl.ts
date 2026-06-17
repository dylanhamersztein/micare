// Generates the Stripe Customer Portal deep link for the authenticated
// Practitioner. Real-mode creates a single-use, Stripe-signed billing-portal
// session URL server-side; mock-mode returns a deterministic in-app URL so
// the e2e suite stays offline and on-origin. Gated by the existing
// VITE_STRIPE_MOCK flag — the portal is a Stripe concern, so it shares the
// Stripe mock toggle rather than introducing a new one.

import { env } from '../env.server'
import { findPractitionerByEmail } from './practitioner-account'
import { getStripe } from './stripe'

export type BillingPortalResult = { url: string }

export async function createBillingPortalUrlImpl(
  email: string,
): Promise<BillingPortalResult | null> {
  const account = await findPractitionerByEmail(email)
  if (!account) return null

  if (env.VITE_STRIPE_MOCK) {
    return { url: '/dashboard?portal=mock' }
  }

  if (!account.stripeCustomerId) {
    throw new Error(
      `Cannot open billing portal: Practitioner ${account.shortId} has no stripe_customer_id`,
    )
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: account.stripeCustomerId,
    return_url: `${env.APP_URL}/dashboard`,
  })
  return { url: session.url }
}
