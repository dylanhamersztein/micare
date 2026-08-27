import { describe, expect, it } from 'vitest'

import { unusedPortionPence } from '../../src/refund-amount'

const period = {
  start: new Date('2026-03-01T00:00:00Z'),
  end: new Date('2026-03-31T00:00:00Z'),
}

describe('unusedPortionPence', () => {
  it('refunds the whole payment when none of the period has been used', () => {
    expect(
      unusedPortionPence({
        amountPaidPence: 2900,
        period,
        now: period.start,
      }),
    ).toBe(2900)
  })

  it('refunds nothing once the period has ended', () => {
    expect(
      unusedPortionPence({
        amountPaidPence: 2900,
        period,
        now: period.end,
      }),
    ).toBe(0)
  })

  it('refunds the share of the payment the period has left', () => {
    expect(
      unusedPortionPence({
        amountPaidPence: 3000,
        period,
        now: new Date('2026-03-16T00:00:00Z'),
      }),
    ).toBe(1500)
  })

  it('rounds down to whole pence so MiCare never over-refunds', () => {
    expect(
      unusedPortionPence({
        amountPaidPence: 2900,
        period,
        now: new Date('2026-03-11T00:00:00Z'),
      }),
    ).toBe(1933)
  })

  it('refunds nothing when the period is already over by some margin', () => {
    expect(
      unusedPortionPence({
        amountPaidPence: 2900,
        period,
        now: new Date('2026-04-15T00:00:00Z'),
      }),
    ).toBe(0)
  })

  it('refunds nothing for a zero-length period rather than dividing by zero', () => {
    expect(
      unusedPortionPence({
        amountPaidPence: 2900,
        period: { start: period.start, end: period.start },
        now: period.start,
      }),
    ).toBe(0)
  })

  it('refunds nothing when nothing was paid', () => {
    expect(
      unusedPortionPence({
        amountPaidPence: 0,
        period,
        now: period.start,
      }),
    ).toBe(0)
  })
})
