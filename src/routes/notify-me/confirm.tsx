// /notify-me/confirm?token=... — the double-opt-in landing page. The token is
// the whole interaction: no account, no session, one click from the inbox.
// Confirming happens in the loader, so the row is flipped before anything
// renders and a refresh is harmless (confirming twice is a no-op update).

import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { NoticePage, STANDALONE_LINK_CLASSES } from '#/components'
import { confirmNotifyMe } from '../../server/notify'

const searchSchema = z.object({ token: z.string().trim().min(1).optional() })

export const Route = createFileRoute('/notify-me/confirm')({
  validateSearch: (raw) => searchSchema.parse(raw),
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: async ({ deps }) => {
    if (!deps.token) return { kind: 'invalid' as const }
    return confirmNotifyMe({ data: { token: deps.token } })
  },
  component: NotifyConfirmPage,
})

function NotifyConfirmPage() {
  const outcome = Route.useLoaderData()

  if (outcome.kind !== 'confirmed') {
    return (
      <NoticePage
        tone="problem"
        eyebrow="Link not recognised"
        title="This link didn't work"
        data-testid="notify-invalid"
      >
        <p>
          It may have been mistyped, or it may belong to a subscription that no
          longer exists. Search again to sign up.
        </p>
        <p>
          <Link to="/search" className={STANDALONE_LINK_CLASSES}>
            Back to search
          </Link>
        </p>
      </NoticePage>
    )
  }

  return (
    <NoticePage
      tone="affirm"
      eyebrow="Confirmed"
      title="You're on the list"
      data-testid="notify-confirmed"
    >
      {/* ADR-0012: the one-click unsubscribe promise is load-bearing, so it is
          restated at the moment the subscription becomes real. */}
      <p>
        We&apos;ll email you when a verified Practitioner lists near your
        postcode. Every email we send has a one-click unsubscribe link.
      </p>
      <p>
        <Link to="/search" className={STANDALONE_LINK_CLASSES}>
          Back to search
        </Link>
      </p>
    </NoticePage>
  )
}
