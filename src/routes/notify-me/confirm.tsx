// /notify-me/confirm?token=... — the double-opt-in landing page. The token is
// the whole interaction: no account, no session, one click from the inbox.
// Confirming happens in the loader, so the row is flipped before anything
// renders and a refresh is harmless (confirming twice is a no-op update).

import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

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
      <div className="mx-auto max-w-2xl p-8" data-testid="notify-invalid">
        <h1 className="text-2xl font-bold">This link didn&apos;t work</h1>
        <p className="mt-2 text-gray-700">
          It may have been mistyped, or it may belong to a subscription that no
          longer exists. Search again to sign up.
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
    <div className="mx-auto max-w-2xl p-8" data-testid="notify-confirmed">
      <h1 className="text-2xl font-bold">You&apos;re on the list</h1>
      <p className="mt-2 text-gray-700">
        We&apos;ll email you when a verified Practitioner lists near your
        postcode. Every email we send has a one-click unsubscribe link.
      </p>
      <p className="mt-4">
        <Link to="/search" className="underline">
          Back to search
        </Link>
      </p>
    </div>
  )
}
