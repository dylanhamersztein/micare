// /go?p=<short_id> — the MiCare-controlled hop between a public profile and a
// Practitioner's external Booking Link. The loader records the click and then
// 302s; nothing is ever rendered on the happy path. A missing, unknown or
// not-currently-listed short_id falls through to the friendly page below
// rather than a stack trace.

import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { NoticePage, STANDALONE_LINK_CLASSES } from '#/components'
import { followBookingLink } from '../server/click-tracking'

// `p` is optional in the schema so a bare /go renders the friendly page
// instead of throwing a validation error at the router.
const searchSchema = z.object({ p: z.string().trim().min(1).optional() })

export const Route = createFileRoute('/go')({
  validateSearch: (raw) => searchSchema.parse(raw),
  loaderDeps: ({ search }) => ({ p: search.p }),
  loader: async ({ deps }) => {
    if (!deps.p) {
      throw notFound()
    }

    const outcome = await followBookingLink({ data: { shortId: deps.p } })
    if (outcome.kind === 'unknown') {
      throw notFound()
    }

    throw redirect({ href: outcome.url, statusCode: 302 })
  },
  component: GoRedirect,
  notFoundComponent: BookingLinkNotFound,
})

// Unreachable in practice — the loader either redirects or throws notFound().
function GoRedirect() {
  return null
}

function BookingLinkNotFound() {
  return (
    <NoticePage
      tone="problem"
      eyebrow="Unavailable"
      title="Booking link unavailable"
      data-testid="go-not-found"
    >
      <p>
        We couldn&apos;t find a booking link for that practitioner. They may no
        longer be listed on MiCare.
      </p>
      <p>
        <a href="/search" className={STANDALONE_LINK_CLASSES}>
          Search for an optician
        </a>
      </p>
    </NoticePage>
  )
}
