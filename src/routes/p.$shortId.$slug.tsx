import { createFileRoute, notFound, redirect } from '@tanstack/react-router'

import {
  NoticePage,
  STANDALONE_LINK_CLASSES,
  VerificationBadge,
  buttonClasses,
} from '#/components'
import { getProfile } from '../server/profile'

import type { ReactNode } from 'react'
import type { PublicProfile } from '../slug'

export const Route = createFileRoute('/p/$shortId/$slug')({
  loader: async ({ params }) => {
    const resolution = await getProfile({
      data: { shortId: params.shortId, slug: params.slug },
    })

    if (resolution.kind === 'unknown') {
      throw notFound()
    }
    // ADR-0005: a stale or arbitrary slug 301s to the canonical URL.
    if (resolution.kind === 'stale') {
      throw redirect({ href: resolution.canonicalUrl, statusCode: 301 })
    }

    return resolution
  },
  component: ProfilePage,
  notFoundComponent: ProfileNotFound,
})

function ProfilePage() {
  const data = Route.useLoaderData()

  if (data.kind === 'not-visible') {
    return <NotListed />
  }
  return <Profile profile={data.profile} />
}

/** One block of the record: a caps heading over its content. */
function Section({
  heading,
  children,
  ...props
}: {
  heading: string
  children: ReactNode
} & { 'data-testid'?: string }) {
  return (
    <section className="border-t border-hairline pt-5" {...props}>
      <h2 className="text-label font-bold tracking-caps text-text-muted uppercase">
        {heading}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function Profile({ profile }: { profile: PublicProfile }) {
  const addressParts = [
    profile.practiceAddressLine1,
    profile.practiceAddressLine2,
    profile.practiceAddressLine3,
    profile.practiceTown,
    profile.practicePostcode,
  ].filter(Boolean)

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-7">
        {profile.photoUrl && (
          <img
            src={profile.photoUrl}
            alt={profile.fullName}
            className="size-32 shrink-0 rounded-md border border-border object-cover"
            data-testid="profile-photo"
          />
        )}
        <div>
          <h1 className="font-serif text-h1 font-medium tracking-tightest">
            {profile.fullName}
          </h1>
          {/* The list variant, not the plaque: the public profile payload
              carries no registration number or check date, and the badge must
              never cite evidence it was not given (ADR-0017). */}
          <p className="mt-3" data-testid="profile-verified">
            <VerificationBadge variant="inline" status="verified" />
          </p>
          <p className="mt-3 text-meta text-text-muted">
            Checked against the General Optical Council register, and re-checked
            weekly.
          </p>
        </div>
      </header>

      {profile.bio && (
        <p className="mt-7 max-w-[62ch] text-text-body">{profile.bio}</p>
      )}

      {/* One primary action, and nothing on the page competes with it.
          A plain anchor, not a <Link>: /go redirects off-site, so the browser
          must do a full navigation rather than a client-side route change. */}
      <div className="mt-7">
        <a
          href={`/go?p=${profile.shortId}`}
          className={buttonClasses({ size: 'lg' })}
          data-testid="profile-book"
        >
          Book an appointment
        </a>
        <p
          className="mt-2 text-meta text-text-muted"
          data-testid="profile-accepting"
        >
          {profile.acceptingNewPatients
            ? 'Accepting new patients'
            : 'Not currently accepting new patients'}
        </p>
      </div>

      <div className="mt-9 flex flex-col gap-5">
        <Section heading="Practice" data-testid="profile-practice">
          {profile.practiceName && (
            <p className="font-semibold">{profile.practiceName}</p>
          )}
          {addressParts.length > 0 && (
            <p className="text-text-body">{addressParts.join(', ')}</p>
          )}
        </Section>

        <Section heading="Opening hours" data-testid="profile-hours">
          {profile.byAppointmentOnly ? (
            <p>By appointment only</p>
          ) : profile.openingHours ? (
            <dl className="flex flex-col gap-1">
              {Object.entries(profile.openingHours).map(([day, hours]) => (
                <div key={day} className="flex gap-3">
                  <dt className="w-28 shrink-0 font-semibold">{day}</dt>
                  <dd className="tabular-nums text-text-body">{hours}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-text-body">
              Contact the Practice for opening hours.
            </p>
          )}
        </Section>

        {profile.services.length > 0 && (
          <Section heading="Services" data-testid="profile-services">
            <ul className="list-disc pl-5 text-text-body marker:text-text-subtle">
              {profile.services.map((service) => (
                <li key={service}>{service}</li>
              ))}
            </ul>
          </Section>
        )}

        {profile.languages.length > 0 && (
          <Section heading="Languages" data-testid="profile-languages">
            <p className="text-text-body">{profile.languages.join(', ')}</p>
          </Section>
        )}

        {profile.accessibilityNotes && (
          <Section heading="Accessibility" data-testid="profile-accessibility">
            <p className="text-text-body">{profile.accessibilityNotes}</p>
          </Section>
        )}
      </div>
    </main>
  )
}

function NotListed() {
  return (
    <NoticePage
      tone="problem"
      eyebrow="Not listed"
      title="This Practitioner is not currently listed"
      data-testid="profile-not-listed"
    >
      <p>
        Their profile is not available right now. They may have paused or ended
        their MiCare listing.
      </p>
      <p>
        <a href="/search" className={STANDALONE_LINK_CLASSES}>
          Search for another Practitioner
        </a>
      </p>
    </NoticePage>
  )
}

function ProfileNotFound() {
  return (
    <NoticePage
      tone="problem"
      eyebrow="Not found"
      title="Profile not found"
      data-testid="profile-not-found"
    >
      <p>We couldn&apos;t find a Practitioner profile at this address.</p>
      <p>
        <a href="/search" className={STANDALONE_LINK_CLASSES}>
          Search for a Practitioner
        </a>
      </p>
    </NoticePage>
  )
}
