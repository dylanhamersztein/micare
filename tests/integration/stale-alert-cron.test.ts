import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/server/db'
import {
  findStalePractitioners,
  handleStaleAlertCron,
} from '../../src/server/stale-alert-cron'

async function cleanup(): Promise<void> {
  await db.query(
    "delete from public.practitioners where short_id like 'sa-test-%'",
  )
}

// Seeds a row the visibility predicate includes: verified, on a dunning-
// tolerant subscription, with every minimum profile field filled. The alert
// reports on that population and nothing else — see ADR-0024.
async function seedVisible(
  shortId: string,
  lastVerifiedDaysAgo: number | null,
  overrides: { subscriptionStatus?: string; practiceName?: string | null } = {},
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into public.practitioners
       (short_id, full_name, goc_number, profession_code, email,
        practice_name, practice_address_line1, practice_postcode,
        booking_link_url,
        verification_status, subscription_status, last_verified_at)
     values ($1, $2, $3, 'optician', $4,
        $6, '1 Register Street', 'EC2V 6AA',
        'https://example.co.uk/book',
        'verified', $7,
        case when $5::int is null then null
             else now() - make_interval(days => $5::int) end)
     returning id`,
    [
      shortId,
      `SA ${shortId}`,
      `99-${shortId}`,
      `${shortId}@example.com`,
      lastVerifiedDaysAgo,
      overrides.practiceName === undefined
        ? `SA Practice ${shortId}`
        : overrides.practiceName,
      overrides.subscriptionStatus ?? 'active',
    ],
  )
  return result.rows[0].id
}

// Clean up after the file too, so no seeded row outlives it on the shared
// Compose DB (fileParallelism: false).
afterAll(cleanup)

describe('findStalePractitioners', () => {
  beforeEach(cleanup)

  it('returns rows older than the threshold and rows never verified', async () => {
    const staleId = await seedVisible('sa-test-old', 20)
    const neverId = await seedVisible('sa-test-never', null)
    await seedVisible('sa-test-fresh', 1)

    const stale = await findStalePractitioners(14)
    const ids = stale.map((p) => p.id)

    expect(ids).toContain(staleId)
    expect(ids).toContain(neverId)
    expect(stale.find((p) => p.short_id === 'sa-test-fresh')).toBeUndefined()
  })

  // The alert is an early warning that listed profiles are going unchecked.
  // A Practitioner the visibility predicate excludes is not listed, so an
  // ageing last_verified_at on their row is not a trust problem to report.
  it('leaves out practitioners the visibility predicate excludes', async () => {
    await seedVisible('sa-test-canceled', 30, {
      subscriptionStatus: 'canceled',
    })
    await seedVisible('sa-test-incomplete', 30, { practiceName: null })

    const shortIds = (await findStalePractitioners(14)).map((p) => p.short_id)

    expect(shortIds).not.toContain('sa-test-canceled')
    expect(shortIds).not.toContain('sa-test-incomplete')
  })
})

describe('handleStaleAlertCron', () => {
  beforeEach(cleanup)

  it('rejects a request without the bearer token', async () => {
    const response = await handleStaleAlertCron(
      new Request('https://micare.co.uk/api/cron/stale-alert'),
    )
    expect(response.status).toBe(401)
  })

  it('delivers via the log channel under ALERT_MOCK', async () => {
    await seedVisible('sa-test-handler', 30)
    const response = await handleStaleAlertCron(
      new Request('https://micare.co.uk/api/cron/stale-alert', {
        headers: { authorization: 'Bearer integration-test-cron-secret' },
      }),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      staleCount: number
      channel: string
    }
    expect(body.staleCount).toBeGreaterThanOrEqual(1)
    expect(body.channel).toBe('log')
  })
})
