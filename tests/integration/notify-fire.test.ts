import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/server/db'
import { onPractitionerBecameVisible } from '../../src/server/notify-fire'

// Default env (ALERT_MOCK=true): no Resend call happens, so these tests read
// the outcome and the ledger. The real Resend boundary — recipients, profile
// link, unsubscribe link — is asserted in notify-fire-resend.test.ts.

const TEST_GOC = '99-160001'
const TEST_EMAIL = 'fire-test-practitioner@example.co.uk'
const TEST_SHORT_ID = 'fire1234'

// Norwich, not London: db/seed.sql plants a confirmed subscriber at SW1A 1AA,
// and these tests assert on counts. Anchoring the fixture away from the seeded
// row keeps "who is in range" a function of this file alone.
// Norwich city centre — the Practitioner practises here.
const NORWICH = { longitude: 1.2933, latitude: 52.6289 }
// Hellesdon, ~2 miles out — comfortably inside the 10-mile radius.
const HELLESDON = { longitude: 1.265, latitude: 52.656 }
// Great Yarmouth, ~18 miles east — outside it.
const GREAT_YARMOUTH = { longitude: 1.7297, latitude: 52.6083 }

type Subscriber = {
  email: string
  postcode: string
  point: { longitude: number; latitude: number }
  confirmed?: boolean
  unsubscribed?: boolean
}

async function insertSubscriber(sub: Subscriber): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.notify_subscriptions
       (email, postcode, point, confirmed_at, unsubscribed_at)
     values ($1, $2,
       extensions.st_setsrid(
         extensions.st_makepoint($3, $4), 4326
       )::extensions.geography,
       case when $5 then now() else null end,
       case when $6 then now() else null end)
     returning id`,
    [
      sub.email,
      sub.postcode,
      sub.point.longitude,
      sub.point.latitude,
      sub.confirmed ?? true,
      sub.unsubscribed ?? false,
    ],
  )
  return rows[0].id
}

async function insertVisiblePractitioner(): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.practitioners (
       short_id, full_name, goc_number, profession_code, email,
       practice_name, practice_address_line1, practice_postcode, practice_town,
       booking_link_url, practice_point,
       verification_status, subscription_status
     ) values ($1, 'Nadia Okafor', $2, 'optician', $3,
       'Norwich Eyecare', '1 Castle Meadow', 'NR2 1RF', 'Norwich',
       'https://example.test/book',
       extensions.st_setsrid(
         extensions.st_makepoint($4, $5), 4326
       )::extensions.geography,
       'verified', 'active')
     returning id`,
    [TEST_SHORT_ID, TEST_GOC, TEST_EMAIL, NORWICH.longitude, NORWICH.latitude],
  )
  return rows[0].id
}

async function cleanup(): Promise<void> {
  await db.query('delete from public.practitioners where email = $1', [
    TEST_EMAIL,
  ])
  await db.query(
    "delete from public.notify_subscriptions where email like 'fire-test-%'",
  )
}

beforeEach(cleanup)
afterEach(cleanup)
afterAll(cleanup)

describe('onPractitionerBecameVisible', () => {
  it('notifies a confirmed subscriber within 10 miles', async () => {
    const practitionerId = await insertVisiblePractitioner()
    await insertSubscriber({
      email: 'fire-test-near@example.co.uk',
      postcode: 'NR6 5DU',
      point: HELLESDON,
    })

    const outcome = await onPractitionerBecameVisible(practitionerId)

    expect(outcome).toEqual({ kind: 'fired', notified: 1 })
  })

  it('leaves a subscriber outside the 10-mile radius alone', async () => {
    const practitionerId = await insertVisiblePractitioner()
    await insertSubscriber({
      email: 'fire-test-far@example.co.uk',
      postcode: 'NR30 1NE',
      point: GREAT_YARMOUTH,
    })

    const outcome = await onPractitionerBecameVisible(practitionerId)

    expect(outcome).toEqual({ kind: 'fired', notified: 0 })
  })

  // Double opt-in (ADR-0012): an address someone else typed into the public
  // form must never receive the payoff email.
  it('leaves an unconfirmed subscriber alone, however close they are', async () => {
    const practitionerId = await insertVisiblePractitioner()
    await insertSubscriber({
      email: 'fire-test-unconfirmed@example.co.uk',
      postcode: 'NR6 5DU',
      point: HELLESDON,
      confirmed: false,
    })

    const outcome = await onPractitionerBecameVisible(practitionerId)

    expect(outcome).toEqual({ kind: 'fired', notified: 0 })
  })

  it('leaves an unsubscribed subscriber alone', async () => {
    const practitionerId = await insertVisiblePractitioner()
    await insertSubscriber({
      email: 'fire-test-gone@example.co.uk',
      postcode: 'NR6 5DU',
      point: HELLESDON,
      unsubscribed: true,
    })

    const outcome = await onPractitionerBecameVisible(practitionerId)

    expect(outcome).toEqual({ kind: 'fired', notified: 0 })
  })

  // The PRD is explicit: a Practitioner who goes hidden and comes back — a
  // lapsed card paid, say — must not re-mail the same subscribers.
  it('fires once and never again for the same Practitioner', async () => {
    const practitionerId = await insertVisiblePractitioner()
    await insertSubscriber({
      email: 'fire-test-near@example.co.uk',
      postcode: 'NR6 5DU',
      point: HELLESDON,
    })

    expect(await onPractitionerBecameVisible(practitionerId)).toEqual({
      kind: 'fired',
      notified: 1,
    })

    expect(await onPractitionerBecameVisible(practitionerId)).toEqual({
      kind: 'already-fired',
    })
  })

  // A cheap guard on a hook that fires from a write path: if the caller is
  // wrong about visibility, the email would link a profile that answers
  // "not visible", and the ledger would burn the one fire this Practitioner
  // ever gets. Neither happens.
  it('sends nothing, and stays unfired, for a Practitioner who is not visible', async () => {
    const practitionerId = await insertVisiblePractitioner()
    await db.query(
      `update public.practitioners
          set subscription_status = 'canceled'
        where id = $1`,
      [practitionerId],
    )
    await insertSubscriber({
      email: 'fire-test-near@example.co.uk',
      postcode: 'NR6 5DU',
      point: HELLESDON,
    })

    expect(await onPractitionerBecameVisible(practitionerId)).toEqual({
      kind: 'not-visible',
    })

    // Still unfired: once they really do become visible, the email goes out.
    await db.query(
      `update public.practitioners
          set subscription_status = 'active'
        where id = $1`,
      [practitionerId],
    )
    expect(await onPractitionerBecameVisible(practitionerId)).toEqual({
      kind: 'fired',
      notified: 1,
    })
  })
})
