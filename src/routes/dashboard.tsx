import {
  Link,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import {
  Button,
  STANDALONE_LINK_CLASSES,
  StatusReadout,
  SubscriptionBadge,
  VerificationBadge,
} from '#/components'
import { openBillingPortal } from '../server/billing-portal'
import { loadDashboard } from '../server/dashboard'
import { signOut } from '../server/auth'
import { SUBSCRIPTION_NOTE } from '../subscription-status'

export const Route = createFileRoute('/dashboard')({
  loader: async () => {
    const result = await loadDashboard()
    if (result.kind === 'unauthenticated') {
      throw redirect({ to: '/login' })
    }
    return result.data
  },
  component: DashboardPage,
})

/** Day-first and two-digit, the form a UK reader reads a record date in. */
const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** Grouped, because 1,284 click-throughs is a number and 1284 is a string. */
const COUNT_FORMAT = new Intl.NumberFormat('en-GB')

function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso))
}

function DashboardPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const [billingBusy, setBillingBusy] = useState(false)
  // Signals to the e2e suite that the route has hydrated and its click
  // handlers are attached, mirroring the login/signup forms. Without this the
  // tests can click the SSR-rendered (but not-yet-interactive) buttons.
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  async function onSignOut() {
    await signOut()
    await router.navigate({ to: '/login' })
  }

  async function onManageBilling() {
    setBillingBusy(true)
    try {
      const result = await openBillingPortal()
      if (result.kind === 'ok') {
        window.location.href = result.url
        return
      }
      await router.navigate({ to: '/login' })
    } finally {
      setBillingBusy(false)
    }
  }

  // A record imported before checks began has no timestamp. The badge renders
  // its cadence instead of a blank where a date belongs, and the tile says so
  // in words rather than printing "Never".
  const lastVerifiedAt =
    data.lastVerifiedAt === null ? undefined : new Date(data.lastVerifiedAt)
  const lastCheckedNote =
    lastVerifiedAt === undefined
      ? 'Not checked yet'
      : `Last checked ${DATE_FORMAT.format(lastVerifiedAt)} · re-checked weekly`

  return (
    <main
      className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-12"
      data-testid="dashboard"
      data-hydrated={hydrated ? 'true' : undefined}
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-label font-bold tracking-caps text-text-muted uppercase">
            Your MiCare listing
          </p>
          <h1 className="mt-1.5 font-serif text-h1 font-medium tracking-tightest text-balance">
            {data.fullName}
          </h1>
        </div>
        <Button
          variant="ghost"
          onClick={onSignOut}
          data-testid="dashboard-sign-out"
        >
          Sign out
        </Button>
      </header>

      <dl className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-4">
        {/* The one number the subscription buys, and the only conversion
            signal MiCare holds. It takes the sand ground and the 48px figure;
            everything beside it stays on white and stays smaller. */}
        <StatusReadout
          label="Click-throughs"
          emphasis
          context={`This billing cycle · since ${formatDate(data.cycleStart)}`}
          figure={
            <span data-testid="dashboard-clickthrough-count">
              {COUNT_FORMAT.format(data.clickthroughCount)}
            </span>
          }
        />

        <StatusReadout
          label="Verification"
          context={
            <span data-testid="dashboard-last-verified-at">
              {lastCheckedNote}
            </span>
          }
        >
          <span data-testid="dashboard-verification-status">
            <VerificationBadge
              status={data.verificationStatus}
              variant="readout"
              lastCheckedAt={lastVerifiedAt}
            />
          </span>
        </StatusReadout>

        {/* `past_due` says so itself: the listing stays public for the whole
            of Stripe's dunning window (ADR-0004), and a Practitioner reading
            "Past due" cold assumes the opposite. */}
        <StatusReadout
          label="Subscription"
          context={SUBSCRIPTION_NOTE[data.subscriptionStatus]}
        >
          <span data-testid="dashboard-subscription-status">
            <SubscriptionBadge status={data.subscriptionStatus} />
          </span>
        </StatusReadout>
      </dl>

      <section className="mt-6 rounded-md border border-border bg-surface-raised p-5.5">
        <h2 className="text-label font-bold tracking-caps text-text-muted uppercase">
          Your listing and your billing
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            to={data.publicProfileUrl}
            className={STANDALONE_LINK_CLASSES}
            data-testid="dashboard-public-profile-link"
          >
            View your public profile
          </Link>
          <Button
            variant="secondary"
            onClick={onManageBilling}
            loading={billingBusy}
            loadingLabel="Opening…"
            data-testid="dashboard-billing-portal"
          >
            Manage billing
          </Button>
        </div>
      </section>
    </main>
  )
}
