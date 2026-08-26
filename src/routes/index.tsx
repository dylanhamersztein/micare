import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  BadgePoundSterling,
  MousePointerClick,
  Route as RouteIcon,
  ShieldCheck,
} from 'lucide-react'

import {
  Button,
  Field,
  SegmentedRadio,
  TEXT_LINK_CLASSES,
  TextInput,
  buttonClasses,
} from '#/components'
import { ALLOWED_RADII_MILES } from '../search-input'

import type { AllowedRadiusMiles } from '../search-input'

export const Route = createFileRoute('/')({
  component: Home,
})

const RADIUS_OPTIONS = ALLOWED_RADII_MILES.map((miles) => ({
  value: miles,
  label: `${miles} miles`,
}))

const EYEBROW_CLASSES =
  'text-label font-bold tracking-caps text-text-muted uppercase'

/** What the directory does, in three facts it can actually stand behind. */
const PROMISES = [
  {
    icon: ShieldCheck,
    heading: 'Checked against the register',
    body: 'A Practitioner is checked against the General Optical Council register before they are ever listed. Fail the check and there is no listing and no charge.',
  },
  {
    icon: RouteIcon,
    heading: 'Ordered by distance, nothing else',
    body: 'No sponsored rows, no promoted placements, no ranking anyone can buy. The nearest verified Practitioner to your search is the first one you see.',
  },
  {
    icon: MousePointerClick,
    heading: 'Booked on their own site',
    body: 'Every profile ends at the Practitioner’s own booking system. MiCare does not sit between you and the appointment, and takes nothing from it.',
  },
] as const

/** What £29 a month buys, in the terms the dashboard actually reports. */
const OFFER_POINTS = [
  'A profile with your Practice name, address, opening hours and services — live the moment the required fields are filled.',
  'A Click-through count for the current Billing Cycle, on your dashboard and in an email the day before each renewal.',
  'Re-verification every week, so your listing keeps saying something a consumer can rely on.',
] as const

// The homepage is the only page both audiences land on cold, so it is laid out
// as two doors rather than one page: the consumer's search is the first thing
// under the headline, and the Practitioner offer is a block of its own further
// down — sand, not paper, because it is addressed to somebody else.
function Home() {
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [radius, setRadius] = useState<AllowedRadiusMiles>(5)
  // Mirrors /search and /signup: the marker tells the E2E suite (and a human
  // watching) that React has attached onSubmit, so a click cannot race the
  // native submit and reload the page with the postcode wiped.
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    void navigate({ to: '/search', search: { q: query.trim(), radius } })
  }

  return (
    <main>
      {/* ── The consumer's door ─────────────────────────────────────── */}
      <section className="border-b border-border bg-surface-sunk">
        {/* Three blocks in source order — headline, search, prose — so a narrow
            screen reads them that way without any reordering. Wide, the grid
            lifts the search into a column of its own beside the other two; the
            `1fr` second row is what absorbs the height the search card has over
            the copy, instead of it opening a hole under the headline. */}
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 py-10 sm:px-6 sm:py-16 lg:grid lg:grid-cols-[minmax(0,1fr)_26rem] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-14 lg:gap-y-6">
          <div className="lg:col-start-1 lg:row-start-1 lg:pt-2">
            <p className={EYEBROW_CLASSES}>Independent UK opticians</p>
            <h1 className="mt-3.5 max-w-[18ch] font-serif text-h1 font-medium tracking-tightest text-balance sm:text-display">
              Every optician here was on the register this week.
            </h1>
          </div>

          <form
            onSubmit={onSubmit}
            className="flex flex-col gap-5 rounded-md border border-border bg-surface-raised p-5 shadow-sm sm:p-6 lg:col-start-2 lg:row-span-2 lg:row-start-1"
            data-testid="home-search-form"
            data-hydrated={hydrated ? 'true' : undefined}
          >
            <h2 className="font-serif text-h2 font-semibold">
              Find an optician near you
            </h2>
            <Field
              label="Postcode or city"
              help="A full UK postcode, or the name of a town or city."
              requirement="required"
            >
              <TextInput
                size="search"
                name="q"
                autoComplete="postal-code"
                placeholder="EC2V 6AA"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                required
                data-testid="home-search-query"
              />
            </Field>
            <div data-testid="home-search-radius">
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
              className="w-full"
              data-testid="home-search-submit"
            >
              Search
            </Button>
            <p className="text-meta text-text-muted">
              Results are ordered by distance from your search.
            </p>
          </form>

          <p
            className="max-w-[56ch] text-text-body lg:col-start-1 lg:row-start-2"
            data-testid="home-consumer-promise"
          >
            MiCare lists independent Practitioners and nobody else. Each one is
            checked against the General Optical Council register when they sign
            up, and re-checked every week after that — anyone who comes off the
            register comes off MiCare. Nothing here is a paid placement.
          </p>
        </div>
      </section>

      {/* ── What that is worth, said three times ────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <h2 className="font-serif text-h1 font-medium tracking-tightest text-balance">
          A directory is only worth the checking behind it.
        </h2>
        <ul className="mt-7 grid gap-7 sm:grid-cols-3 sm:gap-8">
          {PROMISES.map(({ icon: Icon, heading, body }) => (
            <li key={heading} className="border-t-2 border-accent pt-4">
              <Icon
                className="size-6 text-primary"
                strokeWidth={1.9}
                aria-hidden="true"
              />
              <h3 className="mt-2.5 text-title font-semibold">{heading}</h3>
              <p className="mt-1.5 text-meta text-text-body">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── The Practitioner's door ─────────────────────────────────── */}
      <section
        className="border-t border-border bg-surface-sand"
        data-testid="home-practitioner-offer"
      >
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-14">
          <div>
            <p className={EYEBROW_CLASSES}>For Practitioners</p>
            <h2 className="mt-3.5 max-w-[22ch] font-serif text-h1 font-medium tracking-tightest text-balance">
              List your Practice where being registered is the whole point.
            </h2>
            <p className="mt-5 max-w-[58ch] text-text-body">
              The chains own the search results. MiCare is a directory consumers
              come to because everyone in it has been checked — so your listing
              is not competing with an advertising budget, and it is not sitting
              next to anyone who has not been checked either.
            </p>
            <ul className="mt-6 flex max-w-[60ch] flex-col gap-3.5">
              {OFFER_POINTS.map((point) => (
                <li key={point} className="flex gap-3">
                  <ShieldCheck
                    className="mt-1 size-5 shrink-0 text-verified"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span className="text-meta text-text-body">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* The price, at the one size the accent is sanctioned for. */}
          <div className="mt-8 rounded-md border border-border bg-surface-raised p-6 lg:mt-0">
            <p className={EYEBROW_CLASSES}>One price, no tiers</p>
            <p
              className="mt-3 flex items-baseline gap-2"
              data-testid="home-practitioner-price"
            >
              <span className="font-serif text-figure font-medium tracking-tightest text-accent">
                £29
              </span>
              <span className="text-title text-text-body">a month</span>
            </p>
            <p className="mt-3 text-meta text-text-body">
              Your registration is checked while you wait, before you are asked
              for a card. Cancel whenever you like — you stay listed to the end
              of the month you have paid for.
            </p>
            <Link
              to="/signup"
              className={`${buttonClasses({ size: 'lg' })} mt-6 w-full`}
              data-testid="home-practitioner-cta"
            >
              <BadgePoundSterling
                className="size-5 shrink-0"
                strokeWidth={2}
                aria-hidden="true"
              />
              List your Practice
            </Link>
            <p className="mt-3 text-center text-meta text-text-muted">
              Already listed?{' '}
              <Link to="/login" className={TEXT_LINK_CLASSES}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
