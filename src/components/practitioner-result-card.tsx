import { generateProfileUrl } from '../slug'
import { VerificationBadge } from './verification-badge'

import type { ComponentPropsWithoutRef } from 'react'
import type { SearchResult } from '../search-input'

// One row of the register. Name first, then Practice, then address; distance
// sits opposite the name, where the eye lands next, because distance is what
// ordered the list. The whole row is a single link — no "View profile" button
// competing with it — and rows are ruled off from each other with a hairline
// rather than floated apart, so eight results read as one page of a register.

export type PractitionerResultCardProps = Omit<
  ComponentPropsWithoutRef<'li'>,
  'children'
> & {
  result: SearchResult
}

export function PractitionerResultCard({
  result,
  className,
  ...props
}: PractitionerResultCardProps) {
  const address = [
    result.practiceAddressLine1,
    result.practiceTown,
    result.practicePostcode,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    // The rule belongs to the row rather than to the link inside it: a `last:`
    // variant on the link would match every time, since the link is the only
    // child of its row.
    <li
      className={['border-b border-hairline last:border-b-0', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <a
        href={generateProfileUrl(result)}
        className="block px-5 py-5 hover:bg-surface sm:px-6 sm:py-5.5"
      >
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-title font-bold tracking-tightest">
            {result.fullName}
          </span>
          {/* Tabular, so a column of distances lines up down the page. */}
          <span className="shrink-0 font-bold tabular-nums text-text-body">
            {result.distanceMiles.toFixed(1)} miles
          </span>
        </div>
        {result.practiceName && (
          <p className="mt-0.5 text-text-body">{result.practiceName}</p>
        )}
        <p className="mt-0.5 text-meta text-text-muted">{address}</p>
        <span className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-2">
          {/* Every row a search returns is verified — that is what made it
              visible — so the badge is the shared one, in its list variant. */}
          <VerificationBadge variant="inline" status="verified" />
          <span className="inline-flex items-center gap-2 text-meta text-text-body">
            <span
              className={`size-2 shrink-0 rounded-full ${
                result.acceptingNewPatients ? 'bg-verified' : 'bg-border-strong'
              }`}
              aria-hidden="true"
            />
            {result.acceptingNewPatients
              ? 'Accepting new patients'
              : 'Not accepting new patients'}
          </span>
        </span>
      </a>
    </li>
  )
}
