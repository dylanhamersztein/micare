import { describe, expect, it } from 'vitest'

import {
  formatMonthlySummaryEmail,
  renewsTomorrow,
} from '../../src/monthly-summary'

const CYCLE = {
  cycleStart: new Date('2026-05-14T09:30:00.000Z'),
  cycleEnd: new Date('2026-06-14T09:30:00.000Z'),
}

describe('formatMonthlySummaryEmail', () => {
  it('reports the click-through count for the cycle', () => {
    const email = formatMonthlySummaryEmail({
      fullName: 'Jane Optician',
      clickthroughCount: 37,
      ...CYCLE,
    })

    expect(email.text).toContain('Jane Optician')
    expect(email.text).toContain('37')
  })

  it('states the cycle window the count covers', () => {
    const email = formatMonthlySummaryEmail({
      fullName: 'Jane Optician',
      clickthroughCount: 37,
      ...CYCLE,
    })

    expect(email.text).toContain('14 May 2026')
    expect(email.text).toContain('14 June 2026')
  })

  it('uses the singular for exactly one click-through', () => {
    const email = formatMonthlySummaryEmail({
      fullName: 'Jane Optician',
      clickthroughCount: 1,
      ...CYCLE,
    })

    expect(email.text).toContain('1 click-through')
    expect(email.text).not.toContain('1 click-throughs')
  })
})

describe('renewsTomorrow', () => {
  it('is true when the period ends on the next UTC day', () => {
    expect(
      renewsTomorrow(
        new Date('2026-06-14T09:30:00.000Z'),
        new Date('2026-06-13T08:00:00.000Z'),
      ),
    ).toBe(true)
  })

  it('is false when the period ends later today', () => {
    expect(
      renewsTomorrow(
        new Date('2026-06-13T23:00:00.000Z'),
        new Date('2026-06-13T08:00:00.000Z'),
      ),
    ).toBe(false)
  })

  it('is false when the period ends in two days', () => {
    expect(
      renewsTomorrow(
        new Date('2026-06-15T09:30:00.000Z'),
        new Date('2026-06-13T08:00:00.000Z'),
      ),
    ).toBe(false)
  })

  it('crosses month and year boundaries', () => {
    expect(
      renewsTomorrow(
        new Date('2026-07-01T09:30:00.000Z'),
        new Date('2026-06-30T08:00:00.000Z'),
      ),
    ).toBe(true)
    expect(
      renewsTomorrow(
        new Date('2027-01-01T09:30:00.000Z'),
        new Date('2026-12-31T23:59:00.000Z'),
      ),
    ).toBe(true)
  })
})
