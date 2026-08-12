import { describe, expect, it } from 'vitest'

import {
  DEDUP_WINDOW_MS,
  extractVisitor,
  hashVisitor,
} from '../../src/click-tracking'

function requestWith(headers: Record<string, string>): Request {
  return new Request('https://micare.example/go?p=abcd1234', { headers })
}

describe('extractVisitor', () => {
  it('reads the client IP and user agent from the request headers', () => {
    const visitor = extractVisitor(
      requestWith({
        'x-forwarded-for': '203.0.113.7',
        'user-agent': 'Firefox',
      }),
    )

    expect(visitor).toEqual({ ip: '203.0.113.7', userAgent: 'Firefox' })
  })

  it('takes the left-most hop of a multi-proxy x-forwarded-for chain', () => {
    const visitor = extractVisitor(
      requestWith({
        'x-forwarded-for': '203.0.113.7, 198.51.100.2, 10.0.0.1',
        'user-agent': 'Firefox',
      }),
    )

    expect(visitor.ip).toBe('203.0.113.7')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const visitor = extractVisitor(
      requestWith({ 'x-real-ip': '198.51.100.9', 'user-agent': 'Firefox' }),
    )

    expect(visitor.ip).toBe('198.51.100.9')
  })

  it('substitutes placeholders when neither header is present', () => {
    expect(extractVisitor(requestWith({}))).toEqual({
      ip: 'unknown',
      userAgent: 'unknown',
    })
  })
})

describe('hashVisitor', () => {
  it('is stable for the same IP and user agent', () => {
    const visitor = { ip: '203.0.113.7', userAgent: 'Firefox' }

    expect(hashVisitor(visitor)).toBe(hashVisitor(visitor))
  })

  it('differs when the IP differs', () => {
    expect(hashVisitor({ ip: '203.0.113.7', userAgent: 'Firefox' })).not.toBe(
      hashVisitor({ ip: '203.0.113.8', userAgent: 'Firefox' }),
    )
  })

  it('differs when the user agent differs', () => {
    expect(hashVisitor({ ip: '203.0.113.7', userAgent: 'Firefox' })).not.toBe(
      hashVisitor({ ip: '203.0.113.7', userAgent: 'Safari' }),
    )
  })

  it('does not leak the raw IP into the stored value', () => {
    const hash = hashVisitor({ ip: '203.0.113.7', userAgent: 'Firefox' })

    expect(hash).not.toContain('203.0.113.7')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produces different hashes under different salts', () => {
    // A bare sha256 of an IPv4 address is reversible by brute force — the whole
    // address space is 2^32. A deployment salt makes the stored value opaque.
    const visitor = { ip: '203.0.113.7', userAgent: 'Firefox' }

    expect(hashVisitor(visitor, 'salt-a')).not.toBe(
      hashVisitor(visitor, 'salt-b'),
    )
  })

  it('is stable for the same salt', () => {
    const visitor = { ip: '203.0.113.7', userAgent: 'Firefox' }

    expect(hashVisitor(visitor, 'salt-a')).toBe(hashVisitor(visitor, 'salt-a'))
  })

  it('separates the IP and user agent so concatenations cannot collide', () => {
    // Without a delimiter, ("1.2.3.4" + "5Firefox") and ("1.2.3.45" + "Firefox")
    // would hash identically and share a dedup window.
    expect(hashVisitor({ ip: '1.2.3.4', userAgent: '5Firefox' })).not.toBe(
      hashVisitor({ ip: '1.2.3.45', userAgent: 'Firefox' }),
    )
  })
})

describe('DEDUP_WINDOW_MS', () => {
  it('is 24 hours', () => {
    expect(DEDUP_WINDOW_MS).toBe(24 * 60 * 60 * 1000)
  })
})
