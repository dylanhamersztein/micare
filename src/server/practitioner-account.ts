// The single "resolve a Practitioner by their login email" read, shared by
// the magic-link consumer, the dashboard loader, and the billing-portal
// orchestrator. Matching is case-insensitive because email casing is not
// significant. Uses the existing service-role pg connection — there is no RLS
// on this path (ADR-0006).

import type { SubscriptionStatus, VerificationStatus } from '../visibility'
import { db } from './db'

export type PractitionerAccount = {
  id: string
  shortId: string
  email: string
  fullName: string
  practiceName: string | null
  practiceTown: string | null
  verificationStatus: VerificationStatus
  lastVerifiedAt: Date | null
  subscriptionStatus: SubscriptionStatus
  stripeCustomerId: string | null
  createdAt: Date
}

type AccountRow = {
  id: string
  short_id: string
  email: string
  full_name: string
  practice_name: string | null
  practice_town: string | null
  verification_status: VerificationStatus
  last_verified_at: Date | null
  subscription_status: SubscriptionStatus
  stripe_customer_id: string | null
  created_at: Date
}

function mapRow(row: AccountRow): PractitionerAccount {
  return {
    id: row.id,
    shortId: row.short_id,
    email: row.email,
    fullName: row.full_name,
    practiceName: row.practice_name,
    practiceTown: row.practice_town,
    verificationStatus: row.verification_status,
    lastVerifiedAt: row.last_verified_at,
    subscriptionStatus: row.subscription_status,
    stripeCustomerId: row.stripe_customer_id,
    createdAt: row.created_at,
  }
}

export async function findPractitionerByEmail(
  email: string,
): Promise<PractitionerAccount | null> {
  const result = await db.query<AccountRow>(
    `select id, short_id, email, full_name, practice_name, practice_town,
            verification_status, last_verified_at, subscription_status,
            stripe_customer_id, created_at
       from public.practitioners
      where lower(email) = lower($1)
      limit 1`,
    [email.trim()],
  )
  const row = result.rows.at(0)
  return row ? mapRow(row) : null
}
