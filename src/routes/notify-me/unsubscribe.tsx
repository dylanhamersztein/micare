// /notify-me/unsubscribe?token=... — one click, no auth, no confirmation step
// (issue #9). Unsubscribing happens in the loader for the same reason it does
// on the confirm route: the row is updated before render, and repeating the
// click is a no-op.

import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { NoticePage, STANDALONE_LINK_CLASSES } from '#/components'
import { unsubscribeFromNotifyMe } from '../../server/notify'

const searchSchema = z.object({ token: z.string().trim().min(1).optional() })

export const Route = createFileRoute('/notify-me/unsubscribe')({
  validateSearch: (raw) => searchSchema.parse(raw),
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: async ({ deps }) => {
    if (!deps.token) return { kind: 'invalid' as const }
    return unsubscribeFromNotifyMe({ data: { token: deps.token } })
  },
  component: NotifyUnsubscribePage,
})

function NotifyUnsubscribePage() {
  const outcome = Route.useLoaderData()

  if (outcome.kind !== 'unsubscribed') {
    return (
      <NoticePage
        tone="problem"
        eyebrow="Link not recognised"
        title="This link didn't work"
        data-testid="notify-invalid"
      >
        <p>
          It may have been mistyped, or it may belong to a subscription that no
          longer exists. If you keep receiving emails, reply to one and
          we&apos;ll remove you by hand.
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
      eyebrow="Unsubscribed"
      title="You're off the list"
      data-testid="notify-unsubscribed"
    >
      <p>
        You won&apos;t hear from MiCare about this postcode again. Nothing else
        is needed.
      </p>
      <p>
        <Link to="/search" className={STANDALONE_LINK_CLASSES}>
          Back to search
        </Link>
      </p>
    </NoticePage>
  )
}
