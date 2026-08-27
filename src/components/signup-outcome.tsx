import { useEffect, useRef } from 'react'

import { Alert } from './alert'
import { withUnbrokenFigures } from './figures'
import { VerificationBadge } from './verification-badge'
import { GOC_NUMBER_HELP } from '../goc-number'

import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import type { VerificationOutcome } from '../verification'

// One layout carries all three outcomes, so the shape of the page never tells
// a Practitioner whether they passed before they have read a word: the
// Verification record, then what it means, then one thing to do next.
//
// Three rules the design states for this screen, and the tests hold:
//   · Not-found is never an accusation. We only ever claim we could not match
//     what we were given, and every reason we offer is recoverable.
//   · Pending never promises a robot. There is no background retry (ADR-0014
//     is an operator re-running the check by hand), so the copy says so.
//   · Money is stated on every branch. The first question after a failed check
//     is whether they have paid for nothing.

const REGISTER = 'General Optical Council'

/** What we searched the register with, echoed back — the fastest fix is a typo. */
function SearchedFor({
  registrationNumber,
  fullName,
}: {
  registrationNumber: string | undefined
  fullName: string | undefined
}) {
  const rows = [
    { term: 'Registration number', value: registrationNumber, figure: true },
    { term: 'Name as entered', value: fullName, figure: false },
  ].filter((row) => row.value !== undefined)

  if (rows.length === 0) return null

  return (
    <dl className="flex flex-col rounded-md border border-border bg-surface-raised">
      {rows.map(({ term, value, figure }) => (
        <div
          key={term}
          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-hairline px-4.5 py-3.5 first:border-t-0"
        >
          <dt className="text-label font-bold tracking-caps text-text-muted uppercase">
            {term}
          </dt>
          <dd
            className={`text-base font-semibold text-text ${figure ? 'tabular-nums' : ''}`}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Ordered by likelihood, and all three are things the Practitioner can fix. */
const REJECTION_REASONS: ReadonlyArray<{ headline: string; detail: string }> = [
  {
    headline: 'A digit or the prefix is out.',
    detail: GOC_NUMBER_HELP,
  },
  {
    headline: 'Your name differs from the one the register holds.',
    detail: `We match your first and last name against the ones the ${REGISTER} holds — middle names and titles are ignored. If yours has changed and theirs has not, enter it as it appears on your certificate.`,
  },
  {
    headline: 'You joined the register in the last few days.',
    detail:
      'A new entry can take up to a week to appear on the public register we read.',
  },
]

function firstNameOf(fullName: string | undefined): string | undefined {
  const first = fullName?.trim().split(/\s+/)[0]

  return first === undefined || first === '' ? undefined : first
}

export type SignupOutcomeProps = ComponentPropsWithoutRef<'main'> & {
  outcome: VerificationOutcome
  /** Interpolated into the verified badge — never a hardcoded word. */
  profession: string
  /** Absent when a failed submit left signup without the payload it sent. */
  fullName?: string
  registrationNumber?: string
  /** The one way onward, supplied by the route that owns the navigation. */
  children: ReactNode
}

export function SignupOutcome({
  outcome,
  profession,
  fullName,
  registrationNumber,
  children,
  className,
  ...props
}: SignupOutcomeProps) {
  const heading = useRef<HTMLHeadingElement>(null)

  // The outcome arrives without a navigation, so nothing moves focus on its
  // own: a screen reader user would be left at the submit button of a form
  // that is no longer there.
  useEffect(() => {
    heading.current?.focus()
  }, [])

  const firstName = firstNameOf(fullName)

  return (
    <main
      className={[
        'mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <VerificationBadge
        status={outcome}
        profession={profession}
        registrationNumber={registrationNumber}
      />

      <h1
        ref={heading}
        tabIndex={-1}
        className="mt-6 font-serif text-h1 font-medium tracking-tightest text-balance"
      >
        {outcome === 'verified' &&
          (firstName === undefined
            ? "You're on the register."
            : `You're on the register, ${firstName}.`)}
        {outcome === 'rejected' && "We couldn't match those details."}
        {outcome === 'pending' && "The register didn't answer."}
      </h1>

      <div className="mt-4 flex flex-col gap-5 text-text-body">
        {outcome === 'verified' && (
          <>
            <p>
              Your name and registration matched the {REGISTER}
              {registrationNumber === undefined
                ? "'s entry"
                : `'s entry for ${registrationNumber}`}
              . The badge above is the one consumers see on your profile, and we
              re-check it against the register every week.
            </p>
            <Alert tone="info" title="Not public yet">
              Nothing appears in search until your practice details are in and
              your £29-a-month subscription has started. You can cancel at any
              time.
            </Alert>
          </>
        )}

        {outcome === 'rejected' && (
          <>
            <p>
              We check both the number and the name against the {REGISTER}, and
              this is what we checked with. If any of it is wrong, correcting it
              is the fastest fix — you are not locked out, and there is no
              charge.
            </p>
            <SearchedFor
              registrationNumber={registrationNumber}
              fullName={fullName}
            />
            <ol className="flex flex-col gap-4">
              {REJECTION_REASONS.map(({ headline, detail }) => (
                <li key={headline} className="border-l-2 border-border pl-4">
                  <p className="font-semibold text-text">{headline}</p>
                  <p className="mt-0.5 text-meta text-text-muted">
                    {withUnbrokenFigures(detail)}
                  </p>
                </li>
              ))}
            </ol>
          </>
        )}

        {outcome === 'pending' && (
          <>
            <p>
              That is our end, not yours, and it says nothing about your
              registration. Nothing has been charged and no subscription has
              started.
            </p>
            <Alert tone="warning" title="What happens now">
              Nothing retries in the background. A pending check is cleared by
              someone here re-running it by hand, normally within one working
              day. You can also run it again yourself right now — if the
              register is back, you will have your answer in seconds.
            </Alert>
          </>
        )}
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
        {children}
      </div>
    </main>
  )
}
