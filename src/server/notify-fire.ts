// The fire half of the Notify-Me module (issue #18). Capture lives in
// src/server/notify-impl.ts; this is what eventually pays it off — the hook
// the profile editor calls the first time a Practitioner becomes visible.
//
// The module hides from its caller:
//   * which subscriptions are eligible (confirmed, not unsubscribed, in range),
//   * the 10-mile PostGIS radius,
//   * the ledger that makes the fire happen exactly once, ever.

import { milesToMeters } from '../distance'
import { env } from '../env.server'
import { formatNewPractitionerEmail } from '../notify-email'
import { generateProfileUrl } from '../slug'
import { hasMinFields, isVisible } from '../visibility'
import type { SubscriptionStatus, VerificationStatus } from '../visibility'
import { db } from './db'
import { absoluteUrl } from './app-url'
import { unsubscribePathFor } from './notify-impl'
import { sendResendEmail } from './resend'

export type NotifyFireOutcome =
  | { kind: 'fired'; notified: number }
  // The Practitioner has been visible before. Per the PRD, a later visibility
  // flip (reactivation after `canceled → active`, a min-field re-filled) is
  // not news to anyone who was already told.
  | { kind: 'already-fired' }
  // The caller was wrong about visibility, or the row has since gone. Nothing
  // is sent and nothing is recorded, so the real transition still fires.
  | { kind: 'not-visible' }

const RADIUS_MILES = 10

type SubscriberRow = {
  id: string
  email: string
  postcode: string
}

type PractitionerRow = {
  id: string
  short_id: string
  full_name: string
  practice_name: string | null
  practice_address_line1: string | null
  practice_postcode: string | null
  practice_town: string | null
  booking_link_url: string | null
  verification_status: VerificationStatus
  subscription_status: SubscriptionStatus
  has_point: boolean
}

export async function onPractitionerBecameVisible(
  practitionerId: string,
): Promise<NotifyFireOutcome> {
  const { rows: practitioners } = await db.query<PractitionerRow>(
    `select id, short_id, full_name, practice_name, practice_address_line1,
            practice_postcode, practice_town, booking_link_url,
            verification_status, subscription_status,
            practice_point is not null as has_point
       from public.practitioners
      where id = $1`,
    [practitionerId],
  )

  const practitioner = practitioners.at(0)
  if (!practitioner) return { kind: 'not-visible' }

  // The same predicate `/search` and the profile page use (ADR-0002 +
  // ADR-0004), so this hook can never mail a link to a hidden profile.
  const visible =
    practitioner.has_point &&
    isVisible({
      verificationStatus: practitioner.verification_status,
      subscriptionStatus: practitioner.subscription_status,
      minFieldsFilled: hasMinFields({
        fullName: practitioner.full_name,
        practiceName: practitioner.practice_name,
        practiceAddressLine1: practitioner.practice_address_line1,
        practicePostcode: practitioner.practice_postcode,
        bookingLinkUrl: practitioner.booking_link_url,
      }),
    })
  if (!visible) return { kind: 'not-visible' }

  const { rows: subscribers } = await db.query<SubscriberRow>(
    `select s.id, s.email, s.postcode
       from public.notify_subscriptions s
       join public.practitioners p on p.id = $1
      where s.confirmed_at is not null
        and s.unsubscribed_at is null
        and s.point is not null
        and extensions.st_dwithin(s.point, p.practice_point, $2)`,
    [practitionerId, milesToMeters(RADIUS_MILES)],
  )

  // Record-first (ADR-0008): the ledger insert is the dedup gate, so the
  // second caller loses the race and sends nothing.
  const recorded = await db.query(
    `insert into public.notify_fires (practitioner_id, notified_count)
     values ($1, $2)
     on conflict (practitioner_id) do nothing`,
    [practitionerId, subscribers.length],
  )
  if (recorded.rowCount === 0) return { kind: 'already-fired' }

  const profileUrl = absoluteUrl(
    generateProfileUrl({
      shortId: practitioner.short_id,
      fullName: practitioner.full_name,
      practiceName: practitioner.practice_name,
      practiceTown: practitioner.practice_town,
    }),
  )

  for (const subscriber of subscribers) {
    await deliverNotification(subscriber, practitioner, profileUrl)
  }

  return { kind: 'fired', notified: subscribers.length }
}

// Mirrors the other Resend callers (alert-delivery, monthly-summary-cron): a
// structured log line is always emitted as the durable audit trail, and
// ALERT_MOCK short-circuits the send so the suite and local runs stay offline.
async function deliverNotification(
  subscriber: SubscriberRow,
  practitioner: PractitionerRow,
  profileUrl: string,
): Promise<void> {
  const email = formatNewPractitionerEmail({
    fullName: practitioner.full_name,
    practiceName: practitioner.practice_name,
    practiceTown: practitioner.practice_town,
    postcode: subscriber.postcode,
    profileUrl,
    unsubscribeUrl: absoluteUrl(unsubscribePathFor(subscriber.id)),
  })
  console.log(
    '[notify-me:fire]',
    JSON.stringify({
      to: subscriber.email,
      postcode: subscriber.postcode,
      shortId: practitioner.short_id,
    }),
  )
  if (env.ALERT_MOCK) return
  await sendResendEmail({
    from: 'MiCare <noreply@micare.co.uk>',
    to: subscriber.email,
    subject: email.subject,
    text: email.text,
  })
}
