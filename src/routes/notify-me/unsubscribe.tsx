// /notify-me/unsubscribe?token=... — one click, no auth, no confirmation step
// (issue #9). Unsubscribing happens in the loader for the same reason it does
// on the confirm route: the row is updated before render, and repeating the
// click is a no-op.

import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

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
      <div className="mx-auto max-w-2xl p-8" data-testid="notify-invalid">
        <h1 className="text-2xl font-bold">This link didn&apos;t work</h1>
        <p className="mt-2 text-gray-700">
          It may have been mistyped, or it may belong to a subscription that no
          longer exists. If you keep receiving emails, reply to one and
          we&apos;ll remove you by hand.
        </p>
        <p className="mt-4">
          <Link to="/search" className="underline">
            Back to search
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-8" data-testid="notify-unsubscribed">
      <h1 className="text-2xl font-bold">Unsubscribed</h1>
      <p className="mt-2 text-gray-700">
        You won&apos;t hear from MiCare about this postcode again. Nothing else
        is needed.
      </p>
      <p className="mt-4">
        <Link to="/search" className="underline">
          Back to search
        </Link>
      </p>
    </div>
  )
}
