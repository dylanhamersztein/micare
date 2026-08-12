import {
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

// env.server.ts reads ALERT_MOCK once at first import. Force the real send
// path before any dynamic import below, so this file asserts the actual Resend
// HTTP call the consumer's confirmation email rides on.
process.env.ALERT_MOCK = 'false'
process.env.OPERATOR_ALERT_EMAIL = 'ops@example.co.uk'
process.env.RESEND_API_KEY = 're_test_dummy'
process.env.APP_URL = 'https://micare.co.uk'
process.env.NOTIFY_TOKEN_SECRET = 'integration-test-notify-secret'

let subscribeToNotifications: typeof notifyNs.subscribeToNotifications
let confirmNotifySubscription: typeof notifyNs.confirmNotifySubscription
let db: typeof dbApi

const EMAIL = 'notify-resend@example.co.uk'
const EC2V = { postcode: 'EC2V 6AA', longitude: -0.0921, latitude: 51.5144 }

beforeAll(async () => {
  const notify = await import('../../src/server/notify-impl')
  subscribeToNotifications = notify.subscribeToNotifications
  confirmNotifySubscription = notify.confirmNotifySubscription
  db = (await import('../../src/server/db')).db
})

type SentEmail = { to: string; subject: string; text: string }

// One fetch stub serves both boundaries the flow crosses: postcodes.io first,
// then Resend. Returning by URL keeps the test honest about call order.
function stubFetch(): Array<SentEmail> {
  const sent: Array<SentEmail> = []
  vi.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input)
    if (url.startsWith('https://api.postcodes.io/')) {
      return new Response(JSON.stringify({ status: 200, result: EC2V }), {
        status: 200,
      })
    }
    if (url === 'https://api.resend.com/emails') {
      sent.push(JSON.parse((init as RequestInit).body as string) as SentEmail)
      return new Response(null, { status: 200 })
    }
    throw new Error(`unexpected fetch to ${url}`)
  })
  return sent
}

async function cleanup(): Promise<void> {
  await db.query('delete from public.notify_subscriptions where email = $1', [
    EMAIL,
  ])
}

beforeEach(cleanup)

afterEach(async () => {
  vi.restoreAllMocks()
  await cleanup()
})

describe('Notify-Me confirmation email (Resend boundary)', () => {
  it('emails a working confirm link and an unsubscribe link', async () => {
    const sent = stubFetch()

    await subscribeToNotifications({ email: EMAIL, postcode: 'EC2V 6AA' })

    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe(EMAIL)
    expect(sent[0].subject).toMatch(/confirm/i)

    // Every MiCare email carries a one-click opt-out (issue #9).
    expect(sent[0].text).toContain(
      'https://micare.co.uk/notify-me/unsubscribe?token=',
    )

    // The link in the inbox is the one that actually confirms the row.
    const confirmUrl = sent[0].text.match(
      /https:\/\/micare\.co\.uk\/notify-me\/confirm\?token=\S+/,
    )?.[0]
    expect(confirmUrl).toBeDefined()
    const token = new URL(confirmUrl!).searchParams.get('token')!

    expect((await confirmNotifySubscription(token)).kind).toBe('confirmed')
    const rows = await db.query<{ confirmed_at: Date | null }>(
      'select confirmed_at from public.notify_subscriptions where email = $1',
      [EMAIL],
    )
    expect(rows.rows[0].confirmed_at).toBeInstanceOf(Date)
  })

  it('sends nothing once the address is already confirmed', async () => {
    const first = stubFetch()
    await subscribeToNotifications({ email: EMAIL, postcode: 'EC2V 6AA' })
    const token = new URL(
      first[0].text.match(
        /https:\/\/micare\.co\.uk\/notify-me\/confirm\?token=\S+/,
      )![0],
    ).searchParams.get('token')!
    await confirmNotifySubscription(token)

    await subscribeToNotifications({ email: EMAIL, postcode: 'EC2V 6AA' })

    expect(first).toHaveLength(1)
  })
})
