import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'

import {
  ALLOWED_RADII_MILES,
  type AllowedRadiusMiles,
} from '../search-input'
import { search } from '../server/search'

const searchSchema = z.object({
  postcode: z.string().trim().min(1).optional(),
  radius: z.union([z.literal(5), z.literal(10), z.literal(15)]).optional(),
})

export const Route = createFileRoute('/search')({
  validateSearch: (raw) => searchSchema.parse(raw),
  loaderDeps: ({ search: s }) => ({ postcode: s.postcode, radius: s.radius }),
  loader: async ({ deps }) => {
    if (!deps.postcode || !deps.radius) {
      return { kind: 'idle' as const }
    }
    try {
      const results = await search({
        data: { postcode: deps.postcode, radiusMiles: deps.radius },
      })
      return { kind: 'ok' as const, results }
    } catch (error) {
      if ((error as Error).name === 'PostcodeNotFoundError') {
        return { kind: 'postcode-not-found' as const }
      }
      return { kind: 'error' as const }
    }
  },
  component: SearchPage,
})

function SearchPage() {
  const navigate = useNavigate({ from: Route.fullPath })
  const params = Route.useSearch()
  const loaderData = Route.useLoaderData()

  const [postcode, setPostcode] = useState(params.postcode ?? '')
  const [radius, setRadius] = useState<AllowedRadiusMiles>(params.radius ?? 5)

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    void navigate({
      search: { postcode: postcode.trim(), radius },
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
          Enter a UK postcode and a radius to see verified Practitioners near
          you, ordered by distance from your search.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="flex flex-wrap items-end gap-3"
        data-testid="search-form"
      >
        <label className="flex flex-col text-sm">
          Postcode
          <input
            type="text"
            name="postcode"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            required
            className="mt-1 rounded border px-2 py-1"
            data-testid="search-postcode"
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
            Enter a postcode above to start searching.
          </p>
        )}
        {loaderData.kind === 'postcode-not-found' && (
          <p className="text-sm text-red-600" data-testid="search-no-postcode">
            We couldn&apos;t find that postcode. Please check it and try again.
          </p>
        )}
        {loaderData.kind === 'error' && (
          <p className="text-sm text-red-600" data-testid="search-error">
            Something went wrong while searching. Please try again.
          </p>
        )}
        {loaderData.kind === 'ok' && loaderData.results.length === 0 && (
          <p className="text-sm text-gray-600" data-testid="search-empty">
            No verified Practitioners within {params.radius} miles of{' '}
            {params.postcode}.
          </p>
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
