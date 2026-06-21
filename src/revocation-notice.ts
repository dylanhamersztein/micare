// Pure copy for the email a Practitioner receives when their GOC registration
// is revoked (struck off the register) and MiCare removes their listing. No IO
// — delivery + the Resend send live in src/server/revocation-refund-impl.ts.
// Two shapes: `refunded` (we cancelled with proration and refunded the unused
// period) and not-refunded (they were already not being billed).

export type RevocationEmail = { subject: string; text: string }

export function formatRevocationEmail(args: {
  fullName: string
  refunded: boolean
}): RevocationEmail {
  const refundLine = args.refunded
    ? 'We have cancelled your subscription and refunded the unused portion of your current billing period. The refund will appear on your statement within a few business days.'
    : 'Your subscription had already ended, so you were not being billed and there is nothing to refund.'

  const text = [
    `Hi ${args.fullName},`,
    '',
    'During a routine re-verification we found that your registration is no longer active on the General Optical Council register. Because MiCare only lists practitioners with an active registration, your public profile has been removed.',
    '',
    refundLine,
    '',
    'If you believe this is a mistake, please reply to this email and we will look into it.',
    '',
    'The MiCare team',
  ].join('\n')

  return { subject: 'Your MiCare listing has been removed', text }
}
