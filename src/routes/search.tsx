import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { ALLOWED_RADII_MILES } from '../search-input'
import type { AllowedRadiusMiles } from '../search-input'
import { notifyInputSchema } from '../notify-input'
import { search } from '../server/search'
import { subscribeToNotifyMe } from '../server/notify'
import { formatUkPostcode, isFullUkPostcode } from '../uk-postcode'

const searchSchema = z.object({
  q: z.string().trim().min(1).optional(),
  radius: z.union([z.literal(5), z.literal(10), z.literal(15)]).optional(),
})

export const Route = createFileRoute('/search')({
  validateSearch: (raw) => searchSchema.parse(raw),
  loaderDeps: ({ search: s }) => ({ q: s.q, radius: s.radius }),
  loader: async ({ deps }) => {
    if (!deps.q || !deps.radius) {
      return { kind: 'idle' as const }
    }
    try {
      const results = await search({
        data: { postcodeOrCity: deps.q, radiusMiles: deps.radius },
      })
      return { kind: 'ok' as const, results }
    } catch (error) {
      const name = (error as Error).name
      if (
        name === 'LocationNotFoundError' ||
        name === 'PostcodeNotFoundError' ||
        name === 'PlaceNotFoundError'
      ) {
        return { kind: 'location-not-found' as const }
      }
      return { kind: 'error' as const }
    }
  },
  component: SearchPage,
})

// The empty-results CTA. A search that found nobody is the one moment a
// consumer is provably interested and provably unserved, so it is the only
// place MiCare asks for an email (issue #9).
//
// Every submission ends on the same "check your inbox" state — whether the row
// was created, the confirmation was re-sent, or the address was already
// confirmed — so the form can't be used to test whether an address is on the
// list. In ALERT_MOCK dev runs the confirmation link is rendered instead of
// emailed, mirroring the mock login flow.
type NotifyState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'submitted'; confirmPath?: string }
  | { kind: 'error'; message: string }

function NotifyMeForm({ searchedFor }: { searchedFor: string }) {
  const [email, setEmail] = useState('')
  // A search term can be a city name ("Norwich"), which cannot be geocoded to
  // the single point a Notify-Me row needs — prefill only a real postcode.
  const [postcode, setPostcode] = useState(
    isFullUkPostcode(searchedFor) ? formatUkPostcode(searchedFor) : '',
  )
  const [state, setState] = useState<NotifyState>({ kind: 'idle' })
  // Mirrors /signup: the marker tells e2e (and a human watching) that React has
  // attached onSubmit, so a click cannot race the native submit and reload the
  // page with the consumer's email wiped.
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = notifyInputSchema.safeParse({ email, postcode })
    if (!parsed.success) {
      setState({
        kind: 'error',
        message: parsed.error.issues[0]?.message ?? 'Check your details.',
      })
      return
    }

    setState({ kind: 'submitting' })
    try {
      const outcome = await subscribeToNotifyMe({ data: parsed.data })
      if (outcome.kind === 'postcode-not-found') {
        setState({
          kind: 'error',
          message: "We couldn't find that postcode. Please check it and retry.",
        })
        return
      }
      setState({ kind: 'submitted', confirmPath: outcome.confirmPath })
    } catch {
      setState({
        kind: 'error',
        message: 'Something went wrong. Please try again.',
      })
    }
  }

  if (state.kind === 'submitted') {
    return (
      <div className="mt-6 rounded border p-4" data-testid="notify-submitted">
        <h2 className="font-semibold">Check your inbox</h2>
        <p className="mt-1 text-sm text-gray-700">
          We&apos;ve sent you a link to confirm. We&apos;ll only email you once
          a verified Practitioner lists near {postcode}, and every email has a
          one-click unsubscribe.
        </p>
        {state.confirmPath && (
          <p className="mt-3 text-sm">
            <a
              href={state.confirmPath}
              className="underline"
              data-testid="notify-dev-confirm"
            >
              Dev: confirm without email
            </a>
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="mt-6 rounded border p-4">
      <h2 className="font-semibold">Tell me when someone lists here</h2>
      <p className="mt-1 text-sm text-gray-700">
        Leave your email and we&apos;ll let you know when a verified
        Practitioner joins near you.
      </p>
      <form
        onSubmit={onSubmit}
        className="mt-3 flex flex-wrap items-end gap-3"
        data-testid="notify-form"
        data-hydrated={hydrated ? 'true' : undefined}
      >
        <label className="flex flex-col text-sm">
          Email
          <input
            type="email"
            name="notify-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 rounded border px-2 py-1"
            data-testid="notify-email"
          />
        </label>
        <label className="flex flex-col text-sm">
          Postcode
          <input
            type="text"
            name="notify-postcode"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            required
            className="mt-1 rounded border px-2 py-1"
            data-testid="notify-postcode"
          />
        </label>
        <button
          type="submit"
          disabled={state.kind === 'submitting'}
          className="rounded bg-black px-3 py-1 text-white disabled:opacity-50"
          data-testid="notify-submit"
        >
          {state.kind === 'submitting' ? 'Sending…' : 'Notify me'}
        </button>
      </form>
      {state.kind === 'error' && (
        <p className="mt-2 text-sm text-red-600" data-testid="notify-error">
          {state.message}
        </p>
      )}
    </div>
  )
}

function SearchPage() {
  const navigate = useNavigate({ from: Route.fullPath })
  const params = Route.useSearch()
  const loaderData = Route.useLoaderData()

  const [query, setQuery] = useState(params.q ?? '')
  const [radius, setRadius] = useState<AllowedRadiusMiles>(params.radius ?? 5)

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    void navigate({
      search: { q: query.trim(), radius },
    })
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <header className="mb-6">
        <Link to="/" className="text-sm underline">
          ← MiCare home
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Find a Practitioner</h1>
        <p className="mt-1 text-sm text-gray-600">
          Enter a UK postcode or a city/town name and a radius to see verified
          Practitioners near you, ordered by distance from your search.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="flex flex-wrap items-end gap-3"
        data-testid="search-form"
      >
        <label className="flex flex-col text-sm">
          Postcode or city
          <input
            type="text"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
            className="mt-1 rounded border px-2 py-1"
            data-testid="search-query"
          />
        </label>
        <label className="flex flex-col text-sm">
          Radius
          <select
            name="radius"
            value={radius}
            onChange={(e) =>
              setRadius(Number(e.target.value) as AllowedRadiusMiles)
            }
            className="mt-1 rounded border px-2 py-1"
            data-testid="search-radius"
          >
            {ALLOWED_RADII_MILES.map((r) => (
              <option key={r} value={r}>
                {r} miles
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded bg-black px-3 py-1 text-white"
          data-testid="search-submit"
        >
          Search
        </button>
      </form>

      <section className="mt-8" data-testid="search-results">
        {loaderData.kind === 'idle' && (
          <p className="text-sm text-gray-600">
            Enter a postcode or city above to start searching.
          </p>
        )}
        {loaderData.kind === 'location-not-found' && (
          <p className="text-sm text-red-600" data-testid="search-no-location">
            We couldn&apos;t find that location. Please check the spelling and
            try again.
          </p>
        )}
        {loaderData.kind === 'error' && (
          <p className="text-sm text-red-600" data-testid="search-error">
            Something went wrong while searching. Please try again.
          </p>
        )}
        {loaderData.kind === 'ok' && loaderData.results.length === 0 && (
          <>
            <p className="text-sm text-gray-600" data-testid="search-empty">
              No verified Practitioners within {params.radius} miles of{' '}
              {params.q}.
            </p>
            <NotifyMeForm searchedFor={params.q ?? ''} />
          </>
        )}
        {loaderData.kind === 'ok' && loaderData.results.length > 0 && (
          <ul className="space-y-4">
            {loaderData.results.map((practitioner) => (
              <li
                key={practitioner.id}
                className="rounded border p-4"
                data-testid={`search-result-${practitioner.shortId}`}
              >
                <h2 className="text-lg font-semibold">
                  {practitioner.fullName}
                </h2>
                {practitioner.practiceName && (
                  <p className="text-sm">{practitioner.practiceName}</p>
                )}
                <p className="text-sm text-gray-700">
                  {[
                    practitioner.practiceAddressLine1,
                    practitioner.practiceTown,
                    practitioner.practicePostcode,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                <p className="mt-1 text-sm">
                  {practitioner.distanceMiles.toFixed(1)} miles away
                </p>
                <p className="text-sm">
                  {practitioner.acceptingNewPatients
                    ? 'Accepting new patients'
                    : 'Not currently accepting new patients'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
