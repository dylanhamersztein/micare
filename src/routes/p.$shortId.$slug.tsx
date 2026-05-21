import { createFileRoute, notFound, redirect } from '@tanstack/react-router'

import { getProfile } from '../server/profile'
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

function Profile({ profile }: { profile: PublicProfile }) {
  const addressParts = [
    profile.practiceAddressLine1,
    profile.practiceAddressLine2,
    profile.practiceAddressLine3,
    profile.practiceTown,
    profile.practicePostcode,
  ].filter(Boolean)

  return (
    <div className="mx-auto max-w-2xl p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{profile.fullName}</h1>
        <span
          className="mt-2 inline-block rounded bg-green-100 px-2 py-0.5 text-sm font-medium text-green-800"
          data-testid="profile-verified"
        >
          ✓ Verified
        </span>
      </header>

      {profile.photoUrl && (
        <img
          src={profile.photoUrl}
          alt={profile.fullName}
          className="mb-6 h-40 w-40 rounded-full object-cover"
          data-testid="profile-photo"
        />
      )}

      {profile.bio && <p className="mb-6 text-gray-700">{profile.bio}</p>}

      <section className="mb-6" data-testid="profile-practice">
        <h2 className="text-lg font-semibold">Practice</h2>
        {profile.practiceName && <p>{profile.practiceName}</p>}
        {addressParts.length > 0 && (
          <p className="text-sm text-gray-700">{addressParts.join(', ')}</p>
        )}
      </section>

      <section className="mb-6" data-testid="profile-hours">
        <h2 className="text-lg font-semibold">Opening hours</h2>
        {profile.byAppointmentOnly ? (
          <p>By appointment only</p>
        ) : profile.openingHours ? (
          <dl>
            {Object.entries(profile.openingHours).map(([day, hours]) => (
              <div key={day} className="flex gap-2">
                <dt className="font-medium">{day}</dt>
                <dd>{hours}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-gray-600">
            Contact the Practice for opening hours.
          </p>
        )}
      </section>

      {profile.services.length > 0 && (
        <section className="mb-6" data-testid="profile-services">
          <h2 className="text-lg font-semibold">Services</h2>
          <ul className="list-disc pl-5">
            {profile.services.map((service) => (
              <li key={service}>{service}</li>
            ))}
          </ul>
        </section>
      )}

      {profile.languages.length > 0 && (
        <section className="mb-6" data-testid="profile-languages">
          <h2 className="text-lg font-semibold">Languages</h2>
          <p>{profile.languages.join(', ')}</p>
        </section>
      )}

      {profile.accessibilityNotes && (
        <section className="mb-6" data-testid="profile-accessibility">
          <h2 className="text-lg font-semibold">Accessibility</h2>
          <p>{profile.accessibilityNotes}</p>
        </section>
      )}

      <p className="mb-6" data-testid="profile-accepting">
        {profile.acceptingNewPatients
          ? 'Accepting new patients'
          : 'Not currently accepting new patients'}
      </p>

      {/* The Booking Link target URL is wired in Slice 5 (click tracking). */}
      <button
        type="button"
        className="rounded bg-black px-4 py-2 text-white"
        data-testid="profile-book"
      >
        Book an appointment
      </button>
    </div>
  )
}

function NotListed() {
  return (
    <div className="mx-auto max-w-2xl p-8" data-testid="profile-not-listed">
      <h1 className="text-2xl font-bold">
        This Practitioner is not currently listed
      </h1>
      <p className="mt-2 text-gray-700">
        Their profile is not available right now. They may have paused or ended
        their MiCare listing.
      </p>
      <a href="/search" className="mt-4 inline-block underline">
        Search for another Practitioner
      </a>
    </div>
  )
}

function ProfileNotFound() {
  return (
    <div className="mx-auto max-w-2xl p-8" data-testid="profile-not-found">
      <h1 className="text-2xl font-bold">Profile not found</h1>
      <p className="mt-2 text-gray-700">
        We couldn&apos;t find a Practitioner profile at this address.
      </p>
      <a href="/search" className="mt-4 inline-block underline">
        Search for a Practitioner
      </a>
    </div>
  )
}
