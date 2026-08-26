// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SignupOutcome } from '../../../src/components/signup-outcome'
import { GOC_NUMBER_HELP } from '../../../src/goc-number'

import type { VerificationOutcome } from '../../../src/verification'

// The same layout carries all three outcomes, so the shape of the page never
// tells a Practitioner whether they passed before they have read a word. What
// changes is the record at the top, the explanation, and what to do next.
//
// These tests hold the three rules the design states for this screen: not-found
// is never an accusation, pending never promises a robot, and money is
// mentioned on every branch — a Practitioner's first question after a failed
// check is whether they have paid for nothing.

const OUTCOMES: ReadonlyArray<VerificationOutcome> = [
  'verified',
  'rejected',
  'pending',
]

const GOC_NUMBER = '01-31842'

function renderOutcome(
  outcome: VerificationOutcome,
  overrides: { fullName?: string; registrationNumber?: string } = {},
) {
  return render(
    <SignupOutcome
      outcome={outcome}
      profession="Optician"
      fullName={'fullName' in overrides ? overrides.fullName : 'Ravi Kapoor'}
      registrationNumber={
        'registrationNumber' in overrides
          ? overrides.registrationNumber
          : GOC_NUMBER
      }
    >
      <a href="/signup">Somewhere onward</a>
    </SignupOutcome>,
  )
}

describe.each(OUTCOMES)('every outcome — %s', (outcome) => {
  it('leads with the Verification record, in the state the check returned', () => {
    renderOutcome(outcome)

    expect(screen.getByRole('group').getAttribute('aria-label')).toMatch(
      new RegExp(`Verification: ${outcome}`),
    )
  })

  it('says where the Practitioner stands on money', () => {
    const { container } = renderOutcome(outcome)

    expect(container.textContent).toMatch(/charge|subscription|£/)
  })

  it('offers the one thing to do next that the route hands it', () => {
    renderOutcome(outcome)

    expect(screen.getByRole('link', { name: 'Somewhere onward' })).toBeDefined()
  })

  it('gives the outcome heading focus, so it is what a screen reader lands on', () => {
    renderOutcome(outcome)

    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 1 }),
    )
  })
})

describe('the verified outcome', () => {
  it('greets the Practitioner by their first name', () => {
    renderOutcome('verified', { fullName: 'Ravi Kapoor' })

    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(
      /Ravi/,
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toMatch(
      /Kapoor/,
    )
  })

  it('greets nobody by name when signup never learned one', () => {
    renderOutcome('verified', { fullName: undefined })

    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(
      /^You're on the register\.$/,
    )
  })

  it('says the listing is not public until the subscription starts', () => {
    const { container } = renderOutcome('verified')

    expect(container.textContent).toMatch(/not (yet )?public|Not public/)
  })
})

describe('the rejected outcome', () => {
  it('claims only that we could not match, never that they are unregistered', () => {
    const { container } = renderOutcome('rejected')

    expect(container.textContent).toMatch(/could ?n[o’']?t match/i)
    expect(container.textContent).not.toMatch(/not registered|unregistered/i)
  })

  it('shows back what it searched for, because the fastest fix is a typo', () => {
    renderOutcome('rejected')

    expect(screen.getAllByText(GOC_NUMBER).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ravi Kapoor').length).toBeGreaterThan(0)
  })

  it('gives the recoverable reasons, ordered by likelihood', () => {
    renderOutcome('rejected')

    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('states the register format from the schema, not a retyped copy of it', () => {
    const { container } = renderOutcome('rejected')

    expect(container.textContent).toContain(GOC_NUMBER_HELP)
  })

  it('says plainly that nothing was charged', () => {
    const { container } = renderOutcome('rejected')

    expect(container.textContent).toMatch(/no charge/i)
  })
})

describe('the pending outcome', () => {
  it('owns the failure as ours, not the Practitioner’s', () => {
    const { container } = renderOutcome('pending')

    expect(container.textContent).toMatch(/our end/i)
  })

  it('names the operator re-run that actually clears a pending check', () => {
    const { container } = renderOutcome('pending')

    expect(container.textContent).toMatch(/by hand/i)
    expect(container.textContent).toMatch(/one working day/i)
  })

  it('promises no background retry, because there is none', () => {
    const { container } = renderOutcome('pending')

    expect(container.textContent).toMatch(/nothing retries in the background/i)
    expect(container.textContent).not.toMatch(/automatic/i)
  })

  it('promises no email, because signup stores no address to send one to', () => {
    const { container } = renderOutcome('pending')

    expect(container.textContent).not.toMatch(/e-?mail you|we.ll e-?mail/i)
  })

  it('still stands up without a number, the way a failed submit arrives', () => {
    const { container } = renderOutcome('pending', {
      fullName: undefined,
      registrationNumber: undefined,
    })

    expect(container.textContent).not.toMatch(/undefined/)
  })
})
