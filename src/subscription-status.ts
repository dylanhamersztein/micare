// What each of Stripe's six subscription statuses is called on the
// Practitioner's own dashboard, and what it means for their listing.
//
// Stripe is the system of record and MiCare mirrors its status verbatim
// (ADR-0010) — but `past_due` is a word Stripe chose for its own ledger, and
// a Practitioner reading it cold assumes their listing has gone dark. It has
// not: the listing stays public for the whole dunning window (ADR-0004). So
// every status states its own consequence for visibility, and `past_due`
// states the absence of one.

import type { SubscriptionStatus } from './visibility'

/** The one word the dashboard shows. UK spelling; Stripe's key stays Stripe's. */
export const SUBSCRIPTION_WORD: Readonly<Record<SubscriptionStatus, string>> = {
  incomplete: 'Incomplete',
  active: 'Active',
  trialing: 'Trialling',
  past_due: 'Past due',
  unpaid: 'Unpaid',
  canceled: 'Cancelled',
}

/** The one line under it: what this status does to the listing, and nothing else. */
export const SUBSCRIPTION_NOTE: Readonly<Record<SubscriptionStatus, string>> = {
  incomplete:
    'Checkout was never finished, so nothing has been charged and your listing is not published.',
  active: '£29 a month.',
  trialing: 'Inside your trial period. £29 a month when it ends.',
  past_due:
    'A payment did not go through and we are retrying it. This does not hide your listing.',
  unpaid:
    'The retries ran out, so your listing is hidden. Your profile is kept exactly as it is.',
  canceled:
    'The subscription ended, so your listing is hidden. Your profile is kept, so resubscribing brings the same listing back.',
}
