// Single Resend integration point: one POST to the Resend REST API, shared by
// the operator stale-alert digest (alert-delivery.ts) and the practitioner
// refund-on-revocation notice (revocation-refund-impl.ts). Called over fetch
// rather than the Resend SDK so no new npm dependency is added (ADR-0007).
// Callers own the mock gate (ALERT_MOCK) and decide whether to send at all;
// this module only performs the HTTP send and throws on a non-2xx response.

import { env } from '../env.server'

export async function sendResendEmail(args: {
  from: string
  to: string
  subject: string
  text: string
}): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: args.from,
      to: args.to,
      subject: args.subject,
      text: args.text,
    }),
  })
  if (!response.ok) {
    throw new Error(`Resend send failed: HTTP ${response.status}`)
  }
}
