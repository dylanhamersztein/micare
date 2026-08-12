// Server-only implementation of the Notify-Me module. Consumers who search a
// postcode with no verified Practitioner nearby leave an email here; a
// downstream slice fires the actual "someone has listed near you" mail.
//
// The module hides from its caller:
//   * geocoding the postcode into `notify_subscriptions.point`,
//   * the composite (email, postcode) uniqueness that makes a re-submit
//     idempotent while still letting one consumer watch home and work,
//   * minting and checking the signed confirm / unsubscribe links.

import { PostcodeNotFoundError, geocodePostcode } from './geocode'
import type { NotifyInput } from '../notify-input'
import { formatConfirmationEmail } from '../notify-email'
import { db } from './db'
import { env } from '../env.server'
import { signNotifyToken, verifyNotifyToken } from './notify-token'
import { sendResendEmail } from './resend'

// NOTIFY_TOKEN_SECRET is optional (env.server.ts), mirroring
// CLICK_TRACKING_SALT: local/mock runs fall back to a fixed constant so the
// suite needs no setup. Rotating it in production invalidates every confirm
// and unsubscribe link already sitting in an inbox.
const DEV_NOTIFY_SECRET = 'micare-dev-insecure-notify-secret-change-me'

function secret(): string {
  return env.NOTIFY_TOKEN_SECRET ?? DEV_NOTIFY_SECRET
}

function absoluteUrl(path: string): string {
  return `${env.APP_URL ?? 'http://localhost:3000'}${path}`
}

export function confirmPathFor(subscriptionId: string): string {
  const token = signNotifyToken(subscriptionId, 'confirm', secret())
  return `/notify-me/confirm?token=${encodeURIComponent(token)}`
}

export function unsubscribePathFor(subscriptionId: string): string {
  const token = signNotifyToken(subscriptionId, 'unsubscribe', secret())
  return `/notify-me/unsubscribe?token=${encodeURIComponent(token)}`
}

export type SubscribeOutcome =
  // Deliberately the same outcome whether the row was created, the
  // confirmation was re-sent, or the address was already confirmed: the
  // public form must not become an oracle for "is this email subscribed?".
  // `confirmPath` is the ALERT_MOCK dev affordance only — the same shape the
  // AUTH_MOCK login flow uses so local runs can click through without email.
  { kind: 'accepted'; confirmPath?: string } | { kind: 'postcode-not-found' }

export type ConfirmOutcome =
  | { kind: 'confirmed' }
  // Bad signature, wrong purpose, or a row that has since been deleted. One
  // outcome for all three: the page says the same thing either way.
  | { kind: 'invalid' }

export type UnsubscribeOutcome = { kind: 'unsubscribed' } | { kind: 'invalid' }

export async function subscribeToNotifications(
  input: NotifyInput,
): Promise<SubscribeOutcome> {
  let location
  try {
    location = await geocodePostcode(input.postcode)
  } catch (error) {
    if (error instanceof PostcodeNotFoundError) {
      return { kind: 'postcode-not-found' }
    }
    throw error
  }

  // DO UPDATE rather than DO NOTHING so the row is returned either way, and so
  // a consumer who re-subscribes after unsubscribing is re-opted-in by
  // confirming the fresh link (unsubscribed_at is cleared, confirmed_at is
  // not — they still have to click through again).
  const upserted = await db.query<{ id: string; confirmed_at: Date | null }>(
    `insert into public.notify_subscriptions (email, postcode, point)
     values ($1, $2, extensions.st_setsrid(
       extensions.st_makepoint($3, $4), 4326
     )::extensions.geography)
     on conflict (email, postcode) do update
       set unsubscribed_at = null,
           point = excluded.point
     returning id, confirmed_at`,
    [input.email, input.postcode, location.longitude, location.latitude],
  )

  const row = upserted.rows[0]
  // Already confirmed: nothing to re-send, and the caller must not learn that
  // this address is on the list.
  if (row.confirmed_at) return { kind: 'accepted' }

  const confirmPath = confirmPathFor(row.id)

  // ALERT_MOCK short-circuits the send so the suite and local runs stay
  // offline; the path is handed back instead, as the AUTH_MOCK login flow
  // does with its magic link.
  if (env.ALERT_MOCK) {
    console.log(
      '[notify-me]',
      JSON.stringify({ postcode: input.postcode, confirmPath }),
    )
    return { kind: 'accepted', confirmPath }
  }

  await sendResendEmail({
    from: 'MiCare <noreply@micare.co.uk>',
    to: input.email,
    subject: 'Confirm your MiCare notifications',
    text: formatConfirmationEmail({
      postcode: input.postcode,
      confirmUrl: absoluteUrl(confirmPath),
      unsubscribeUrl: absoluteUrl(unsubscribePathFor(row.id)),
    }),
  })

  return { kind: 'accepted' }
}

export async function confirmNotifySubscription(
  token: string,
): Promise<ConfirmOutcome> {
  const id = verifyNotifyToken(token, 'confirm', secret())
  if (!id) return { kind: 'invalid' }

  // coalesce, not now(): a prefetching mail client or a second click must not
  // rewrite when consent was actually given.
  const updated = await db.query(
    `update public.notify_subscriptions
        set confirmed_at = coalesce(confirmed_at, now())
      where id = $1`,
    [id],
  )
  if (updated.rowCount === 0) return { kind: 'invalid' }

  return { kind: 'confirmed' }
}

export async function unsubscribeFromNotifications(
  token: string,
): Promise<UnsubscribeOutcome> {
  const id = verifyNotifyToken(token, 'unsubscribe', secret())
  if (!id) return { kind: 'invalid' }

  // One click, no confirmation step, and no auth — the link in the email is
  // the whole interaction. Idempotent by design: clicking twice, or a mail
  // client prefetching the link, must not error.
  const updated = await db.query(
    `update public.notify_subscriptions
        set unsubscribed_at = coalesce(unsubscribed_at, now())
      where id = $1`,
    [id],
  )
  if (updated.rowCount === 0) return { kind: 'invalid' }

  return { kind: 'unsubscribed' }
}
