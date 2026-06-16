import { describe, expect, it } from 'vitest'

import { currentBillingCycle } from '../../src/billing-cycle'

const iso = (d: Date) => d.toISOString()

describe('currentBillingCycle', () => {
  it('returns the cycle that contains now, anchored on the anchor day-of-month', () => {
    const anchor = new Date('2026-01-15T00:00:00.000Z')
    const cycle = currentBillingCycle(anchor, new Date('2026-03-10T12:00:00Z'))
    expect(iso(cycle.start)).toBe('2026-02-15T00:00:00.000Z')
    expect(iso(cycle.end)).toBe('2026-03-15T00:00:00.000Z')
  })

  it('rolls to the next cycle once now passes the anchor day', () => {
    const anchor = new Date('2026-01-15T00:00:00.000Z')
    const cycle = currentBillingCycle(anchor, new Date('2026-03-20T00:00:00Z'))
    expect(iso(cycle.start)).toBe('2026-03-15T00:00:00.000Z')
    expect(iso(cycle.end)).toBe('2026-04-15T00:00:00.000Z')
  })

  it('treats the anchor instant itself as the start of its cycle', () => {
    const anchor = new Date('2026-06-14T09:30:00.000Z')
    const cycle = currentBillingCycle(anchor, anchor)
    expect(iso(cycle.start)).toBe('2026-06-14T09:30:00.000Z')
    expect(iso(cycle.end)).toBe('2026-07-14T09:30:00.000Z')
  })

  it('clamps a 31st anchor into short months', () => {
    const anchor = new Date('2026-01-31T00:00:00.000Z')
    const cycle = currentBillingCycle(anchor, new Date('2026-02-15T00:00:00Z'))
    // January cycle started on the 31st; February has no 31st, so the cycle
    // end clamps to Feb 28.
    expect(iso(cycle.start)).toBe('2026-01-31T00:00:00.000Z')
    expect(iso(cycle.end)).toBe('2026-02-28T00:00:00.000Z')
  })

  it('preserves cycle length across a year boundary', () => {
    const anchor = new Date('2025-12-05T00:00:00.000Z')
    const cycle = currentBillingCycle(anchor, new Date('2026-01-10T00:00:00Z'))
    expect(iso(cycle.start)).toBe('2026-01-05T00:00:00.000Z')
    expect(iso(cycle.end)).toBe('2026-02-05T00:00:00.000Z')
  })
})
