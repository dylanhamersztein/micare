// Pure copy for the email a Practitioner receives when their GOC registration
// is revoked (struck off the register) and MiCare removes their listing. No IO
// — delivery + the Resend send live in src/server/revocation-refund-impl.ts.
//
// Three shapes, one per way the money can land (ADR-0029): `refunded` quotes
// the amount that was actually put back on the card, `nothing-to-refund`
// cancelled a subscription with no unused portion left, and `not-billed` had
// no live subscription to cancel. The email states the amount rather than
// promising a refund in the abstract — it may claim only what MiCare has
// actually done (ADR-0019).

export type RevocationEmail = { subject: string; text: string }

export type RevocationRefund =
  | { kind: 'refunded'; pence: number }
  | { kind: 'nothing-to-refund' }
  | { kind: 'not-billed' }

function formatPounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

function refundLine(refund: RevocationRefund): string {
  switch (refund.kind) {
    case 'refunded':
      return `We have cancelled your subscription and refunded ${formatPounds(refund.pence)} — the unused portion of your current billing period. The refund will appear on your statement within a few business days.`
    case 'nothing-to-refund':
      return 'We have cancelled your subscription. There was no unused portion left on your current billing period, so there is nothing to refund.'
    case 'not-billed':
      return 'Your subscription had already ended, so you were not being billed and there is nothing to refund.'
  }
}

export function formatRevocationEmail(args: {
  fullName: string
  refund: RevocationRefund
}): RevocationEmail {
  const text = [
    `Hi ${args.fullName},`,
    '',
    'During a routine re-verification we found that your registration is no longer active on the General Optical Council register. Because MiCare only lists practitioners with an active registration, your public profile has been removed.',
    '',
    refundLine(args.refund),
    '',
    'If you believe this is a mistake, please reply to this email and we will look into it.',
    '',
    'The MiCare team',
  ].join('\n')

  return { subject: 'Your MiCare listing has been removed', text }
}
