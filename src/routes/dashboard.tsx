import {
  Link,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'

import { openBillingPortal } from '../server/billing-portal'
import { loadDashboard } from '../server/dashboard'
import { signOut } from '../server/auth'
import type { SubscriptionStatus, VerificationStatus } from '../visibility'

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

const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Rejected',
  revoked: 'Revoked',
}

const SUBSCRIPTION_LABELS: Record<SubscriptionStatus, string> = {
  incomplete: 'Incomplete',
  active: 'Active',
  trialing: 'Trialing',
  past_due: 'Past due',
  unpaid: 'Unpaid',
  canceled: 'Canceled',
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function DashboardPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const [billingBusy, setBillingBusy] = useState(false)

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

  return (
    <div className="mx-auto max-w-2xl p-8" data-testid="dashboard">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Your dashboard</h1>
        <button
          type="button"
          onClick={onSignOut}
          className="text-sm underline"
          data-testid="dashboard-sign-out"
        >
          Sign out
        </button>
      </header>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Readout
          label="Verification status"
          testId="dashboard-verification-status"
        >
          {VERIFICATION_LABELS[data.verificationStatus]}
        </Readout>

        <Readout
          label="Subscription status"
          testId="dashboard-subscription-status"
        >
          {SUBSCRIPTION_LABELS[data.subscriptionStatus]}
        </Readout>

        <Readout
          label="Click-throughs this billing cycle"
          testId="dashboard-clickthrough-count"
        >
          {data.clickthroughCount}
        </Readout>

        <Readout label="Last verified" testId="dashboard-last-verified-at">
          {formatDate(data.lastVerifiedAt)}
        </Readout>

        <div className="rounded border p-4">
          <dt className="text-xs uppercase text-gray-500">Public profile</dt>
          <dd className="mt-1">
            <Link
              to={data.publicProfileUrl}
              className="underline"
              data-testid="dashboard-public-profile-link"
            >
              View your public profile
            </Link>
          </dd>
        </div>

        <div className="rounded border p-4">
          <dt className="text-xs uppercase text-gray-500">Billing</dt>
          <dd className="mt-1">
            <button
              type="button"
              onClick={onManageBilling}
              disabled={billingBusy}
              className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
              data-testid="dashboard-billing-portal"
            >
              {billingBusy ? 'Opening…' : 'Manage billing'}
            </button>
          </dd>
        </div>
      </dl>
    </div>
  )
}

function Readout({
  label,
  testId,
  children,
}: {
  label: string
  testId: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded border p-4">
      <dt className="text-xs uppercase text-gray-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold" data-testid={testId}>
        {children}
      </dd>
    </div>
  )
}
