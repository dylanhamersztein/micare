import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../../src/server/db'
import { handleManualVerifyRequest } from '../../src/server/manual-verify'

const ENDPOINT = 'https://micare.co.uk/api/admin/verify-practitioner'
const RESERVED = ['99-000001', '99-000002', '99-000003', '99-000004']

async function cleanup(): Promise<void> {
  await db.query(
    `delete from public.practitioners
      where short_id like 'mvr-test-%' or goc_number = any($1)`,
    [RESERVED],
  )
  await db.query(
    'delete from public.verifications where goc_number = any($1)',
    [RESERVED],
  )
}

async function seedPending(
  shortId: string,
  gocNumber: string,
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.practitioners
       (short_id, full_name, goc_number, profession_code, email,
        verification_status, subscription_status, visible)
     values ($1, $2, $3, 'optician', $4, 'pending', 'incomplete', false)
     returning id`,
    [shortId, `MVR ${shortId}`, gocNumber, `${shortId}@example.com`],
  )
  return rows[0].id
}

function request(body: unknown, token?: string): Request {
  return new Request(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

afterAll(cleanup)

describe('handleManualVerifyRequest auth', () => {
  beforeEach(cleanup)

  it('turns away a caller without the operator token', async () => {
    const id = await seedPending('mvr-test-unauth', '99-000001')

    const response = await handleManualVerifyRequest(
      request({ gocNumber: '99-000001' }),
    )

    expect(response.status).toBe(401)
    const { rows } = await db.query<{ verification_status: string }>(
      'select verification_status from public.practitioners where id = $1',
      [id],
    )
    expect(rows[0].verification_status).toBe('pending')
  })
})

const TOKEN = 'integration-test-operator-secret'

describe('handleManualVerifyRequest', () => {
  beforeEach(cleanup)

  it('recovers a stuck-pending Practitioner and reports what it did', async () => {
    const id = await seedPending('mvr-test-ok', '99-000001')

    const response = await handleManualVerifyRequest(
      request({ gocNumber: '99-000001', force: true }, TOKEN),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      kind: 'applied',
      gocNumber: '99-000001',
      practitionerId: id,
      previousStatus: 'pending',
      result: 'found-active',
      newStatus: 'verified',
      forced: true,
    })

    const { rows } = await db.query<{ verification_status: string }>(
      'select verification_status from public.practitioners where id = $1',
      [id],
    )
    expect(rows[0].verification_status).toBe('verified')
  })

  it('answers a malformed payload with a readable 400', async () => {
    const response = await handleManualVerifyRequest(
      request({ gocNumber: '99000001' }, TOKEN),
    )

    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: string }
    expect(body.error).toMatch(/GOC number/i)
  })

  it('answers 404 for a GOC number no Practitioner holds', async () => {
    const response = await handleManualVerifyRequest(
      request({ gocNumber: '99-000001' }, TOKEN),
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({
      kind: 'no-such-practitioner',
    })
  })

  it('answers 409 for a Practitioner who is not stuck in pending', async () => {
    const id = await seedPending('mvr-test-verified', '99-000001')
    await db.query(
      "update public.practitioners set verification_status = 'verified' where id = $1",
      [id],
    )

    const response = await handleManualVerifyRequest(
      request({ gocNumber: '99-000001' }, TOKEN),
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      kind: 'not-pending',
      verificationStatus: 'verified',
    })
  })
})

// Manual re-verification is the one place a human moves a Practitioner
// between verification states by hand. The log line is the whole audit trail
// (Vercel logs), exactly as it is for the three cron routes.
describe('handleManualVerifyRequest audit trail', () => {
  beforeEach(cleanup)

  it('logs what the operator did, whether or not it changed anything', async () => {
    const logged = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await seedPending('mvr-test-audit', '99-000002')
      await handleManualVerifyRequest(
        request({ gocNumber: '99-000002', force: true }, TOKEN),
      )
      await handleManualVerifyRequest(
        request({ gocNumber: '99-000003' }, TOKEN),
      )

      const lines = logged.mock.calls.map((call) => call.join(' '))
      expect(
        lines.some(
          (line) =>
            line.includes('[admin:verify-practitioner]') &&
            line.includes('99-000002') &&
            line.includes('rejected'),
        ),
        `applied run not logged; saw ${JSON.stringify(lines)}`,
      ).toBe(true)
      expect(
        lines.some(
          (line) =>
            line.includes('[admin:verify-practitioner]') &&
            line.includes('99-000003') &&
            line.includes('no-such-practitioner'),
        ),
        `refused run not logged; saw ${JSON.stringify(lines)}`,
      ).toBe(true)
    } finally {
      logged.mockRestore()
    }
  })
})
