import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { db } from '../../src/server/db'
import {
  confirmNotifySubscription,
  subscribeToNotifications,
  unsubscribeFromNotifications,
} from '../../src/server/notify-impl'
import { signNotifyToken } from '../../src/server/notify-token'

// Matches tests/integration/setup.ts, so a test can forge the link a consumer
// would have received.
const NOTIFY_SECRET = 'integration-test-notify-secret'

// Default env (ALERT_MOCK=true): no Resend fetch happens, so the only fetch the
// module makes is the postcodes.io lookup, stubbed below. The real Resend
// boundary is asserted in notify-resend.test.ts.
const EC2V = { postcode: 'EC2V 6AA', longitude: -0.0921, latitude: 51.5144 }
const NR2 = { postcode: 'NR2 1RF', longitude: 1.2933, latitude: 52.6289 }

function mockGeocode(result: typeof EC2V | null) {
  vi.mocked(fetch).mockResolvedValueOnce(
    result
      ? new Response(JSON.stringify({ status: 200, result }), { status: 200 })
      : new Response(
          JSON.stringify({ status: 404, error: 'Postcode not found' }),
          {
            status: 404,
          },
        ),
  )
}

async function cleanup(): Promise<void> {
  await db.query(
    "delete from public.notify_subscriptions where email like 'notify-test-%'",
  )
}

type SubscriptionRow = {
  id: string
  email: string
  postcode: string
  confirmed_at: Date | null
  unsubscribed_at: Date | null
  longitude: number | null
  latitude: number | null
}

async function rowsFor(email: string): Promise<Array<SubscriptionRow>> {
  const result = await db.query<SubscriptionRow>(
    `select id, email, postcode, confirmed_at, unsubscribed_at,
            extensions.st_x(point::extensions.geometry) as longitude,
            extensions.st_y(point::extensions.geometry) as latitude
       from public.notify_subscriptions
      where email = $1
      order by postcode`,
    [email],
  )
  return result.rows
}

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn())
  await cleanup()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

afterAll(cleanup)

describe('subscribeToNotifications', () => {
  it('records an unconfirmed subscription geocoded to the postcode', async () => {
    mockGeocode(EC2V)

    const outcome = await subscribeToNotifications({
      email: 'notify-test-jane@example.co.uk',
      postcode: 'EC2V 6AA',
    })

    expect(outcome.kind).toBe('accepted')
    const rows = await rowsFor('notify-test-jane@example.co.uk')
    expect(rows).toHaveLength(1)
    expect(rows[0].postcode).toBe('EC2V 6AA')
    expect(rows[0].confirmed_at).toBeNull()
    expect(rows[0].longitude).toBeCloseTo(EC2V.longitude, 4)
    expect(rows[0].latitude).toBeCloseTo(EC2V.latitude, 4)
  })

  it('is idempotent: the same email and postcode twice is one subscription', async () => {
    mockGeocode(EC2V)
    mockGeocode(EC2V)

    const first = await subscribeToNotifications({
      email: 'notify-test-twice@example.co.uk',
      postcode: 'EC2V 6AA',
    })
    const second = await subscribeToNotifications({
      email: 'notify-test-twice@example.co.uk',
      postcode: 'EC2V 6AA',
    })

    expect(first.kind).toBe('accepted')
    expect(second.kind).toBe('accepted')
    expect(await rowsFor('notify-test-twice@example.co.uk')).toHaveLength(1)
  })

  // A consumer who lost the first email must be able to ask for another; a
  // consumer who already confirmed must not be re-mailed by anyone who types
  // their address into the public form.
  it('re-issues the confirmation while the subscription is unconfirmed', async () => {
    mockGeocode(EC2V)
    mockGeocode(EC2V)

    const first = await subscribeToNotifications({
      email: 'notify-test-resend@example.co.uk',
      postcode: 'EC2V 6AA',
    })
    const second = await subscribeToNotifications({
      email: 'notify-test-resend@example.co.uk',
      postcode: 'EC2V 6AA',
    })

    expect(first.kind === 'accepted' && first.confirmPath).toBeTruthy()
    expect(second.kind === 'accepted' && second.confirmPath).toBeTruthy()
  })

  it('stays silent once the subscription is confirmed', async () => {
    const token = await subscribeAndGetToken('notify-test-quiet@example.co.uk')
    await confirmNotifySubscription(token)
    mockGeocode(EC2V)

    const again = await subscribeToNotifications({
      email: 'notify-test-quiet@example.co.uk',
      postcode: 'EC2V 6AA',
    })

    // Same outcome the first submit gave — but nothing new is sent.
    expect(again.kind).toBe('accepted')
    expect(again.kind === 'accepted' && again.confirmPath).toBeUndefined()
  })

  it('lets one consumer watch more than one postcode', async () => {
    mockGeocode(EC2V)
    mockGeocode(NR2)

    await subscribeToNotifications({
      email: 'notify-test-both@example.co.uk',
      postcode: 'EC2V 6AA',
    })
    await subscribeToNotifications({
      email: 'notify-test-both@example.co.uk',
      postcode: 'NR2 1RF',
    })

    const rows = await rowsFor('notify-test-both@example.co.uk')
    expect(rows.map((r) => r.postcode)).toEqual(['EC2V 6AA', 'NR2 1RF'])
  })

  it('records nothing when the postcode does not exist', async () => {
    mockGeocode(null)

    const outcome = await subscribeToNotifications({
      email: 'notify-test-nowhere@example.co.uk',
      postcode: 'ZZ9 9ZZ',
    })

    expect(outcome.kind).toBe('postcode-not-found')
    expect(await rowsFor('notify-test-nowhere@example.co.uk')).toHaveLength(0)
  })
})

// ALERT_MOCK (the suite default) hands back a clickable confirm path instead of
// emailing one, exactly as the AUTH_MOCK login flow does. Tests follow that
// path, so they exercise the same token the email would have carried.
function tokenFrom(path: string): string {
  return new URL(path, 'https://micare.co.uk').searchParams.get('token') ?? ''
}

async function subscribeAndGetToken(email: string): Promise<string> {
  mockGeocode(EC2V)
  const outcome = await subscribeToNotifications({
    email,
    postcode: 'EC2V 6AA',
  })
  if (outcome.kind !== 'accepted' || !outcome.confirmPath) {
    throw new Error(`expected an accepted subscription, got ${outcome.kind}`)
  }
  return tokenFrom(outcome.confirmPath)
}

describe('confirmNotifySubscription', () => {
  it('confirms the subscription the link was minted for', async () => {
    const token = await subscribeAndGetToken(
      'notify-test-confirm@example.co.uk',
    )

    const outcome = await confirmNotifySubscription(token)

    expect(outcome.kind).toBe('confirmed')
    const rows = await rowsFor('notify-test-confirm@example.co.uk')
    expect(rows[0].confirmed_at).toBeInstanceOf(Date)
  })

  // Mail clients prefetch links, and consumers double-click them. The second
  // visit must not rewrite when they opted in — that timestamp is the consent
  // record.
  it('keeps the original opt-in time when the link is clicked twice', async () => {
    const token = await subscribeAndGetToken(
      'notify-test-twice-c@example.co.uk',
    )
    await confirmNotifySubscription(token)
    const [first] = await rowsFor('notify-test-twice-c@example.co.uk')

    await new Promise((resolve) => setTimeout(resolve, 20))
    const outcome = await confirmNotifySubscription(token)

    expect(outcome.kind).toBe('confirmed')
    const [second] = await rowsFor('notify-test-twice-c@example.co.uk')
    expect(second.confirmed_at?.getTime()).toBe(first.confirmed_at?.getTime())
  })

  it('leaves the subscription alone when the token is not ours', async () => {
    await subscribeAndGetToken('notify-test-forged@example.co.uk')
    const [row] = await rowsFor('notify-test-forged@example.co.uk')
    const forged = signNotifyToken(row.id, 'confirm', 'not-the-real-secret')

    const outcome = await confirmNotifySubscription(forged)

    expect(outcome.kind).toBe('invalid')
    const after = await rowsFor('notify-test-forged@example.co.uk')
    expect(after[0].confirmed_at).toBeNull()
  })

  it('will not confirm using an unsubscribe link', async () => {
    await subscribeAndGetToken('notify-test-crosspurpose@example.co.uk')
    const [row] = await rowsFor('notify-test-crosspurpose@example.co.uk')

    const outcome = await confirmNotifySubscription(
      signNotifyToken(row.id, 'unsubscribe', NOTIFY_SECRET),
    )

    expect(outcome.kind).toBe('invalid')
    const after = await rowsFor('notify-test-crosspurpose@example.co.uk')
    expect(after[0].confirmed_at).toBeNull()
  })
})

describe('unsubscribeFromNotifications', () => {
  it('unsubscribes on the link alone — no auth, no second step', async () => {
    const token = await subscribeAndGetToken('notify-test-bye@example.co.uk')
    await confirmNotifySubscription(token)
    const [row] = await rowsFor('notify-test-bye@example.co.uk')

    const outcome = await unsubscribeFromNotifications(
      signNotifyToken(row.id, 'unsubscribe', NOTIFY_SECRET),
    )

    expect(outcome.kind).toBe('unsubscribed')
    const after = await rowsFor('notify-test-bye@example.co.uk')
    expect(after[0].unsubscribed_at).toBeInstanceOf(Date)
  })
})
