// Pure body text for the Notify-Me emails, kept out of
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

// The payoff email (issue #18): a verified Practitioner has just become
// visible within 10 miles of a postcode this consumer confirmed they were
// watching. Subject carries the postcode because a consumer may hold several
// subscriptions and the inbox is where they tell them apart.
export function formatNewPractitionerEmail(args: {
  fullName: string
  practiceName: string | null
  practiceTown: string | null
  postcode: string
  profileUrl: string
  unsubscribeUrl: string
}): { subject: string; text: string } {
  const where = [args.practiceName, args.practiceTown]
    .filter((part): part is string => Boolean(part))
    .join(', ')

  return {
    subject: `A verified optician has listed near ${args.postcode}`,
    text: [
      `${args.fullName} is now listed on MiCare${where ? ` at ${where}` : ''}, near ${args.postcode}.`,
      '',
      'See the profile and book:',
      args.profileUrl,
      '',
      `Unsubscribe: ${args.unsubscribeUrl}`,
    ].join('\n'),
  }
}
