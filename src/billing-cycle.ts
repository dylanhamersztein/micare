// Pure billing-cycle math. Given a subscription anchor instant and a
// reference 'now', returns the monthly cycle [start, end) that contains now,
// with the cycle boundary falling on the anchor's day-of-month (clamped into
// short months). Anchored on practitioners.created_at by the dashboard so no
// live Stripe call is needed; see the slice-10 plan's key-decisions note for
// the future "prefer Stripe's stored period bounds" refinement.

export type BillingCycle = { start: Date; end: Date }

// Build a UTC instant for (year, month, day) carrying the anchor's wall-clock
// time, clamping `day` to the number of days in that month. `month` may be
// out of 0–11 range; Date.UTC normalises it (e.g. month -1 => prior December).
function boundary(
  year: number,
  month: number,
  day: number,
  h: number,
  m: number,
  s: number,
  ms: number,
): Date {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(
    Date.UTC(year, month, Math.min(day, daysInMonth), h, m, s, ms),
  )
}

export function currentBillingCycle(anchor: Date, now: Date): BillingCycle {
  const day = anchor.getUTCDate()
  const h = anchor.getUTCHours()
  const m = anchor.getUTCMinutes()
  const s = anchor.getUTCSeconds()
  const ms = anchor.getUTCMilliseconds()

  let start = boundary(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    day,
    h,
    m,
    s,
    ms,
  )
  if (start.getTime() > now.getTime()) {
    start = boundary(
      now.getUTCFullYear(),
      now.getUTCMonth() - 1,
      day,
      h,
      m,
      s,
      ms,
    )
  }
  const end = boundary(
    start.getUTCFullYear(),
    start.getUTCMonth() + 1,
    day,
    h,
    m,
    s,
    ms,
  )
  return { start, end }
}
