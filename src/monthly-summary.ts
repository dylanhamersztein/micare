// Pure half of the monthly summary email (issue #15). Copy only — no IO. The
// Stripe period lookup, the clickthroughs aggregation and the Resend send live
// in src/server/monthly-summary-cron.ts.

export type MonthlySummaryEmail = { subject: string; text: string }

// The summary lands the day before the renewal, so the job asks this of every
// eligible Practitioner's period end once a day. Compared as UTC calendar days
// rather than a 24h offset: the cron fires at a fixed hour, and a renewal at
// 02:00 tomorrow is still "tomorrow" to a job running at 09:00 today.
export function renewsTomorrow(periodEnd: Date, now: Date): boolean {
  const oneDay = 24 * 60 * 60 * 1000
  return utcDay(periodEnd) - utcDay(now) === oneDay
}

function utcDay(instant: Date): number {
  return Date.UTC(
    instant.getUTCFullYear(),
    instant.getUTCMonth(),
    instant.getUTCDate(),
  )
}

// Dates are rendered in UTC to match the cycle boundaries themselves, which
// are Stripe period instants — not the reader's local midnight.
const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function formatMonthlySummaryEmail(args: {
  fullName: string
  clickthroughCount: number
  cycleStart: Date
  cycleEnd: Date
}): MonthlySummaryEmail {
  const text = [
    `Hi ${args.fullName},`,
    '',
    `Your MiCare profile got ${args.clickthroughCount} click-through${args.clickthroughCount === 1 ? '' : 's'} this billing cycle.`,
    '',
    `Cycle: ${DATE_FORMAT.format(args.cycleStart)} to ${DATE_FORMAT.format(args.cycleEnd)}.`,
    '',
    'The MiCare team',
  ].join('\n')

  return { subject: 'Your MiCare month in review', text }
}
