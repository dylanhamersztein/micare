// Delivers the daily stale-verification digest two ways (ADR-0007): always a
// structured log line (durable audit trail in Vercel logs) and, when
// ALERT_MOCK is false, a digest email to OPERATOR_ALERT_EMAIL via the Resend
// REST API. Resend is called over fetch — no new npm dependency, matching the
// "no new external dependency" decision. ALERT_MOCK (default true) keeps the
// suite and local runs offline.

import { env } from '../env.server'
import { formatStaleAlertText } from '../stale-alert'
import type { StalePractitioner } from '../stale-alert'
import { sendResendEmail } from './resend'

export type AlertChannel = 'log' | 'email'

export async function deliverStaleAlert(
  stale: ReadonlyArray<StalePractitioner>,
): Promise<{ channel: AlertChannel }> {
  const body = formatStaleAlertText(stale, env.STALE_VERIFICATION_DAYS)

  // Always emit the structured log line — this is the queryable audit trail.
  console.log(
    '[cron:stale-alert]',
    JSON.stringify({ staleCount: stale.length, body }),
  )

  // Nothing to email, or email is mocked off: the log line is the delivery.
  if (env.ALERT_MOCK || stale.length === 0) {
    return { channel: 'log' }
  }

  await sendResendEmail({
    from: 'MiCare Alerts <alerts@micare.co.uk>',
    to: env.OPERATOR_ALERT_EMAIL!,
    subject: `MiCare: ${stale.length} stale practitioner verification(s)`,
    text: body,
  })
  return { channel: 'email' }
}
