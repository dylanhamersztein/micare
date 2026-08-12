// Pure body text for the Notify-Me double-opt-in email, kept out of
// src/server/notify-impl.ts for the same reason src/stale-alert.ts and
// src/revocation-notice.ts are: the wording is worth reading in a unit test
// without a database or a Resend key in scope.

export function formatConfirmationEmail(args: {
  postcode: string
  confirmUrl: string
  unsubscribeUrl: string
}): string {
  return [
    `You asked MiCare to tell you when a verified Practitioner lists near ${args.postcode}.`,
    '',
    'Confirm that this is you:',
    args.confirmUrl,
    '',
    'If you did not ask for this, ignore this email — nothing will be sent until you confirm.',
    '',
    `Unsubscribe: ${args.unsubscribeUrl}`,
  ].join('\n')
}
