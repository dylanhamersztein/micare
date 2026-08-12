// `click-tracking` pure core — the DB-free half of Slice 5. Turns an inbound
// /go request into the opaque visitor identifier the `clickthroughs` event log
// stores, and owns the dedup window constant. Everything here is a pure
// function of its inputs so the whole surface is unit-testable without a
// database; the write path and Booking Link resolution live in
// src/server/click-tracking-impl.ts.

import { createHash } from 'node:crypto'

// Refreshes and back-button returns inside this window collapse onto the first
// click, so a Practitioner's count reflects distinct visitors, not page loads.
export const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000

export type Visitor = {
  ip: string
  userAgent: string
}

export function extractVisitor(request: Request): Visitor {
  const forwardedFor = request.headers.get('x-forwarded-for')
  // The left-most hop is the originating client; everything after it is our
  // own proxy chain.
  const ip =
    forwardedFor?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'

  return {
    ip,
    userAgent: request.headers.get('user-agent')?.trim() || 'unknown',
  }
}

// We never store a raw IP. A bare sha256 of one is not much better — the IPv4
// space is small enough to brute-force — so the caller mixes in a deployment
// salt (src/server/click-tracking-impl.ts supplies it from the environment).
// The newline delimiter keeps ("1.2.3.4", "5Firefox") from hashing the same as
// ("1.2.3.45", "Firefox"); such a collision would silently merge two visitors
// into one dedup window.
export function hashVisitor({ ip, userAgent }: Visitor, salt = ''): string {
  return createHash('sha256')
    .update(`${salt}\n${ip}\n${userAgent}`)
    .digest('hex')
}
