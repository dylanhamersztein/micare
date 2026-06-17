import { describe, expect, it } from 'vitest'

import { cronAuthError } from '../../src/server/cron-auth'

function req(authHeader?: string): Request {
  return new Request('https://micare.co.uk/api/cron/re-verify', {
    headers: authHeader ? { authorization: authHeader } : undefined,
  })
}

describe('cronAuthError', () => {
  it('returns null when the bearer token matches', () => {
    expect(cronAuthError(req('Bearer s3cret'), 's3cret')).toBeNull()
  })

  it('returns 401 when the header is missing', () => {
    expect(cronAuthError(req(), 's3cret')?.status).toBe(401)
  })

  it('returns 401 when the token does not match', () => {
    expect(cronAuthError(req('Bearer wrong'), 's3cret')?.status).toBe(401)
  })

  it('returns 500 when no secret is configured', () => {
    expect(cronAuthError(req('Bearer anything'), undefined)?.status).toBe(500)
  })
})
