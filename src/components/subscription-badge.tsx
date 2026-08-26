import { SUBSCRIPTION_NOTE, SUBSCRIPTION_WORD } from '../subscription-status'

import type { SubscriptionStatus } from '../visibility'

// The subscription half of the dashboard's two state readouts. Same shape as
// the Verification badge's inline variant — a mark, then the word — but a dot
// rather than a glyph, because Stripe's six states are not six kinds of
// evidence and drawing them as such would overstate them.
//
// The word carries the state; the dot only reinforces it. What the dot must
// not do is lie by association: `past_due` is a card being retried while the
// listing stays public (ADR-0004), so it gets the pending hue, not the hue
// `unpaid` gets when the retries have run out.

const DOT_TONE: Readonly<Record<SubscriptionStatus, string>> = {
  incomplete: 'bg-sub-incomplete',
  active: 'bg-sub-active',
  trialing: 'bg-sub-trialing',
  past_due: 'bg-sub-past-due',
  unpaid: 'bg-sub-unpaid',
  canceled: 'bg-sub-canceled',
}

export type SubscriptionBadgeProps = {
  status: SubscriptionStatus
}

export function SubscriptionBadge({ status }: SubscriptionBadgeProps) {
  return (
    <span
      role="group"
      aria-label={`Subscription: ${SUBSCRIPTION_WORD[status]}. ${SUBSCRIPTION_NOTE[status]}`}
      className="inline-flex items-center gap-2.5"
    >
      <span
        aria-hidden="true"
        className={`size-2.5 shrink-0 rounded-full ${DOT_TONE[status]}`}
      />
      <span className="text-h2 font-bold tracking-tightest text-text">
        {SUBSCRIPTION_WORD[status]}
      </span>
    </span>
  )
}
