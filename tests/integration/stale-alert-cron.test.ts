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

async function seedVisible(
  shortId: string,
  lastVerifiedDaysAgo: number | null,
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into public.practitioners
       (short_id, full_name, goc_number, profession_code, email,
        verification_status, subscription_status, visible, last_verified_at)
     values ($1, $2, $3, 'optician', $4, 'verified', 'active', true,
        case when $5::int is null then null
             else now() - make_interval(days => $5::int) end)
     returning id`,
    [
      shortId,
      `SA ${shortId}`,
      `99-${shortId}`,
      `${shortId}@example.com`,
      lastVerifiedDaysAgo,
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
