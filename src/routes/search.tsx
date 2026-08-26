import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import {
  Alert,
  Button,
  Field,
  PractitionerResultCard,
  SegmentedRadio,
  STANDALONE_LINK_CLASSES,
  TEXT_LINK_CLASSES,
  TextInput,
} from '#/components'
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

const RADIUS_OPTIONS = ALLOWED_RADII_MILES.map((miles) => ({
  value: miles,
  label: `${miles} miles`,
}))

const EYEBROW_CLASSES =
  'text-label font-bold tracking-caps text-text-muted uppercase'

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
      <div
        className="rounded-md border border-border bg-surface-sand p-6"
        data-testid="notify-submitted"
      >
        <Alert tone="info" title="Check your inbox">
          We&apos;ve sent you a link to confirm. We&apos;ll only email you once
          a verified Practitioner lists near {postcode}, and every email has a
          one-click unsubscribe.
        </Alert>
        {state.confirmPath && (
          <p className="mt-4">
            <a
              href={state.confirmPath}
              className={TEXT_LINK_CLASSES}
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
    // Sand rather than white: the capture is the point of this screen, not a
    // form bolted under an apology, so it is the one block that changes colour.
    <div className="rounded-md border border-border bg-surface-sand p-6">
      <h2 className="font-serif text-h2 font-semibold">
        Tell me when someone lists here
      </h2>
      <p className="mt-1.5 text-text-body">
        Leave your email and we&apos;ll let you know when a verified
        Practitioner joins near you.
      </p>
      <form
        onSubmit={onSubmit}
        className="mt-5 flex flex-col gap-4"
        data-testid="notify-form"
        data-hydrated={hydrated ? 'true' : undefined}
      >
        <Field
          label="Email address"
          help="We send one message to confirm it, then nothing until there is news."
          requirement="required"
        >
          <TextInput
            type="email"
            name="notify-email"
            autoComplete="email"
            placeholder="you@example.co.uk"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            data-testid="notify-email"
          />
        </Field>
        <Field label="Postcode" requirement="required">
          <TextInput
            name="notify-postcode"
            autoComplete="postal-code"
            className="tabular-nums"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            required
            data-testid="notify-postcode"
          />
        </Field>
        <Button
          type="submit"
          size="lg"
          loading={state.kind === 'submitting'}
          loadingLabel="Sending…"
          data-testid="notify-submit"
        >
          Notify me
        </Button>
      </form>
      {/* ADR-0012: the double opt-in and the one-click unsubscribe are the
          promise, not filler — they stay on the screen that asks. */}
      <p className="mt-4 text-meta text-text-body">
        A confirmation email arrives in a minute or two. Until you click the
        link in it we hold nothing. No newsletter, no partners, unsubscribe in
        one click.
      </p>
      {state.kind === 'error' && (
        <div className="mt-4" data-testid="notify-error">
          <Alert tone="error" title={state.message} />
        </div>
      )}
    </div>
  )
}

// An empty register page is evidence, not an apology: nothing within the
// radius means exactly one thing, and saying so plainly is the proposition.
function EmptyResults({
  searchedFor,
  radiusMiles,
}: {
  searchedFor: string
  radiusMiles: AllowedRadiusMiles
}) {
  const wider = ALLOWED_RADII_MILES.filter((miles) => miles > radiusMiles)

  return (
    <div data-testid="search-empty">
      <p className={EYEBROW_CLASSES}>
        0 results · {searchedFor} · within {radiusMiles} miles
      </p>
      <h2 className="mt-3 font-serif text-h1 font-medium tracking-tightest text-balance">
        No verified Practitioner within {radiusMiles} miles of {searchedFor} —
        yet.
      </h2>
      <p className="mt-4 max-w-[56ch] text-text-body">
        We only list Practitioners we have checked against the General Optical
        Council register, and we would rather show you nothing than show you
        someone we cannot vouch for.
      </p>
      <div className="mt-7">
        <NotifyMeForm searchedFor={searchedFor} />
      </div>
      {wider.length > 0 && (
        <div className="mt-7 flex flex-wrap gap-x-7 gap-y-1 border-t border-hairline pt-5">
          {wider.map((miles) => (
            <Link
              key={miles}
              to="/search"
              search={{ q: searchedFor, radius: miles }}
              className={STANDALONE_LINK_CLASSES}
            >
              Search {miles} miles instead
            </Link>
          ))}
        </div>
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
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <header>
        <Link to="/" className={TEXT_LINK_CLASSES}>
          ← MiCare home
        </Link>
        <h1 className="mt-3 font-serif text-h1 font-medium tracking-tightest">
          Find a Practitioner
        </h1>
        <p className="mt-2 max-w-[60ch] text-text-body">
          Enter a UK postcode or a city/town name and a radius to see verified
          Practitioners near you, ordered by distance from your search.
        </p>
      </header>

      {/* The controls stay on the page with what was searched still in them:
          a consumer widening a radius should never retype their postcode. */}
      <form
        onSubmit={onSubmit}
        className="mt-7 flex flex-col gap-5 rounded-md border border-border bg-surface-raised p-5 sm:p-6"
        data-testid="search-form"
      >
        <Field label="Postcode or city" requirement="required">
          <TextInput
            size="search"
            name="q"
            autoComplete="postal-code"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
            data-testid="search-query"
          />
        </Field>
        <div data-testid="search-radius">
          <SegmentedRadio
            legend="Search radius"
            name="radius"
            options={RADIUS_OPTIONS}
            value={radius}
            onChange={setRadius}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="w-full sm:w-auto sm:self-start"
          data-testid="search-submit"
        >
          Search
        </Button>
      </form>

      <section className="mt-9" data-testid="search-results">
        {loaderData.kind === 'idle' && (
          <p className="text-text-body">
            Enter a postcode or city above to start searching.
          </p>
        )}
        {loaderData.kind === 'location-not-found' && (
          <div data-testid="search-no-location">
            <Alert tone="warning" title="We couldn't find that location">
              Please check the spelling and try again.
            </Alert>
          </div>
        )}
        {loaderData.kind === 'error' && (
          <div data-testid="search-error">
            <Alert tone="error" title="We could not load these results">
              Something went wrong while searching. Please try again.
            </Alert>
          </div>
        )}
        {loaderData.kind === 'ok' && loaderData.results.length === 0 && (
          <EmptyResults
            searchedFor={params.q ?? ''}
            radiusMiles={params.radius ?? 5}
          />
        )}
        {loaderData.kind === 'ok' && loaderData.results.length > 0 && (
          <>
            {/* Stated once for the whole list, which is why no row repeats it. */}
            <p className={EYEBROW_CLASSES}>
              {loaderData.results.length}{' '}
              {loaderData.results.length === 1 ? 'result' : 'results'} ·{' '}
              {params.q} · within {params.radius} miles · all listings
              re-checked weekly
            </p>
            <ul className="mt-3 overflow-hidden rounded-md border border-border bg-surface-raised">
              {loaderData.results.map((practitioner) => (
                <PractitionerResultCard
                  key={practitioner.id}
                  result={practitioner}
                  data-testid={`search-result-${practitioner.shortId}`}
                />
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  )
}
