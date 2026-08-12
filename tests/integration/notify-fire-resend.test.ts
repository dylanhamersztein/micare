import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import type { db as dbApi } from '../../src/server/db'
import type * as notifyNs from '../../src/server/notify-impl'
import type * as fireNs from '../../src/server/notify-fire'

// env.server.ts reads ALERT_MOCK once at first import. Force the real send
// path before any dynamic import below, so this file asserts the actual Resend
// HTTP calls the "someone has listed near you" mail rides on.
process.env.ALERT_MOCK = 'false'
process.env.OPERATOR_ALERT_EMAIL = 'ops@example.co.uk'
process.env.RESEND_API_KEY = 're_test_dummy'
process.env.APP_URL = 'https://micare.co.uk'
process.env.NOTIFY_TOKEN_SECRET = 'integration-test-notify-secret'

let onPractitionerBecameVisible: typeof fireNs.onPractitionerBecameVisible
let unsubscribeFromNotifications: typeof notifyNs.unsubscribeFromNotifications
let db: typeof dbApi

const TEST_GOC = '99-160002'
const TEST_EMAIL = 'fire-resend-practitioner@example.co.uk'
const TEST_SHORT_ID = 'firs1234'

const NORWICH = { longitude: 1.2933, latitude: 52.6289 }
const HELLESDON = { longitude: 1.265, latitude: 52.656 }
const GREAT_YARMOUTH = { longitude: 1.7297, latitude: 52.6083 }

beforeAll(async () => {
  onPractitionerBecameVisible = (await import('../../src/server/notify-fire'))
    .onPractitionerBecameVisible
  unsubscribeFromNotifications = (await import('../../src/server/notify-impl'))
    .unsubscribeFromNotifications
  db = (await import('../../src/server/db')).db
})

type SentEmail = { to: string; subject: string; text: string }

function stubResend(): Array<SentEmail> {
  const sent: Array<SentEmail> = []
  vi.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input)
    if (url === 'https://api.resend.com/emails') {
      sent.push(JSON.parse((init as RequestInit).body as string) as SentEmail)
      return new Response(null, { status: 200 })
    }
    throw new Error(`unexpected fetch to ${url}`)
  })
  return sent
}

async function insertSubscriber(sub: {
  email: string
  postcode: string
  point: { longitude: number; latitude: number }
}): Promise<void> {
  await db.query(
    `insert into public.notify_subscriptions
       (email, postcode, point, confirmed_at)
     values ($1, $2,
       extensions.st_setsrid(
         extensions.st_makepoint($3, $4), 4326
       )::extensions.geography,
       now())`,
    [sub.email, sub.postcode, sub.point.longitude, sub.point.latitude],
  )
}

async function insertVisiblePractitioner(): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.practitioners (
       short_id, full_name, goc_number, profession_code, email,
       practice_name, practice_address_line1, practice_postcode, practice_town,
       booking_link_url, practice_point,
       verification_status, subscription_status, visible
     ) values ($1, 'Nadia Okafor', $2, 'optician', $3,
       'Norwich Eyecare', '1 Castle Meadow', 'NR2 1RF', 'Norwich',
       'https://example.test/book',
       extensions.st_setsrid(
         extensions.st_makepoint($4, $5), 4326
       )::extensions.geography,
       'verified', 'active', true)
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
    "delete from public.notify_subscriptions where email like 'fire-resend-%'",
  )
}

beforeEach(cleanup)

afterEach(async () => {
  vi.restoreAllMocks()
  await cleanup()
})

afterAll(cleanup)

describe('Notify-Me fire (Resend boundary)', () => {
  it('emails every in-range confirmed subscriber the new profile link', async () => {
    const sent = stubResend()
    const practitionerId = await insertVisiblePractitioner()
    await insertSubscriber({
      email: 'fire-resend-near@example.co.uk',
      postcode: 'NR6 5DU',
      point: HELLESDON,
    })
    await insertSubscriber({
      email: 'fire-resend-far@example.co.uk',
      postcode: 'NR30 1NE',
      point: GREAT_YARMOUTH,
    })

    await onPractitionerBecameVisible(practitionerId)

    expect(sent.map((e) => e.to)).toEqual(['fire-resend-near@example.co.uk'])
    // ADR-0005's canonical URL: /p/<short_id>/<slug>.
    expect(sent[0].text).toContain(
      'https://micare.co.uk/p/firs1234/nadia-okafor-norwich-eyecare-norwich',
    )
    // The postcode this consumer subscribed with, not the Practitioner's.
    expect(sent[0].subject).toContain('NR6 5DU')
  })

  // ADR-0012: the unsubscribe link rides in every MiCare email, and one click
  // is the whole interaction — no auth, no confirmation step.
  it('carries an unsubscribe link that takes the consumer off the list', async () => {
    const sent = stubResend()
    const practitionerId = await insertVisiblePractitioner()
    await insertSubscriber({
      email: 'fire-resend-near@example.co.uk',
      postcode: 'NR6 5DU',
      point: HELLESDON,
    })

    await onPractitionerBecameVisible(practitionerId)

    const unsubscribeUrl = sent[0].text.match(
      /https:\/\/micare\.co\.uk\/notify-me\/unsubscribe\?token=\S+/,
    )?.[0]
    expect(unsubscribeUrl).toBeDefined()
    const token = new URL(unsubscribeUrl!).searchParams.get('token')!

    expect((await unsubscribeFromNotifications(token)).kind).toBe(
      'unsubscribed',
    )
    const { rows } = await db.query<{ unsubscribed_at: Date | null }>(
      `select unsubscribed_at from public.notify_subscriptions
        where email = 'fire-resend-near@example.co.uk'`,
    )
    expect(rows[0].unsubscribed_at).toBeInstanceOf(Date)
  })
})
