// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SubscriptionBadge } from '../../../src/components/subscription-badge'
import { VerificationBadge } from '../../../src/components/verification-badge'
import {
  SUBSCRIPTION_NOTE,
  SUBSCRIPTION_WORD,
} from '../../../src/subscription-status'
import { compileStylesFor, declarationsFor } from '../support/rendered-styles'

import type { SubscriptionStatus } from '../../../src/visibility'

const STATUSES: ReadonlyArray<SubscriptionStatus> = [
  'incomplete',
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'canceled',
]

/** The colour the badge's dot is painted, as a browser would paint it. */
async function dotColour(element: Element): Promise<string> {
  const dot = element.querySelector('[aria-hidden="true"]')!
  const css = await compileStylesFor(dot)

  return declarationsFor(css, dot)['background-color']
}

describe('SubscriptionBadge', () => {
  for (const status of STATUSES) {
    it(`says ${status} in words rather than leaving it to the dot`, () => {
      render(<SubscriptionBadge status={status} />)

      expect(screen.getByText(SUBSCRIPTION_WORD[status])).toBeDefined()
    })

    it(`tells a screen reader what ${status} means for the listing`, () => {
      render(<SubscriptionBadge status={status} />)

      expect(screen.getByRole('group').getAttribute('aria-label')).toContain(
        SUBSCRIPTION_NOTE[status],
      )
    })
  }

  it('gives each of the six states a colour of its own', async () => {
    const colours: Array<string> = []

    for (const status of STATUSES) {
      const { container, unmount } = render(
        <SubscriptionBadge status={status} />,
      )
      colours.push(await dotColour(container.firstElementChild!))
      unmount()
    }

    expect(new Set(colours).size).toBe(STATUSES.length)
  })

  // ADR-0004: the listing stays public for the whole dunning window. Painting
  // a retry in the colour of a dead subscription tells the Practitioner they
  // have gone dark when they have not.
  it('does not paint past_due in the colour it paints unpaid', async () => {
    const retrying = render(<SubscriptionBadge status="past_due" />)
    const retryingColour = await dotColour(
      retrying.container.firstElementChild!,
    )
    retrying.unmount()

    const dead = render(<SubscriptionBadge status="unpaid" />)
    const deadColour = await dotColour(dead.container.firstElementChild!)

    expect(retryingColour).not.toBe(deadColour)
  })
})

// A revoked registration and an unpaid subscription are different failures
// with different remedies — one is the regulator's word, the other is a card.
describe('an unpaid subscription beside a revoked registration', () => {
  it('does not use the same word', () => {
    const { unmount } = render(<SubscriptionBadge status="unpaid" />)
    const subscription = screen.getByRole('group').textContent
    unmount()

    render(<VerificationBadge status="revoked" variant="inline" />)

    expect(screen.getByRole('group').textContent).not.toBe(subscription)
  })

  it('does not use the same colour', async () => {
    const unpaid = render(<SubscriptionBadge status="unpaid" />)
    const unpaidColour = await dotColour(unpaid.container.firstElementChild!)
    unpaid.unmount()

    const revoked = render(
      <VerificationBadge status="revoked" variant="inline" />,
    )
    const chip = revoked.container.firstElementChild!
    const css = await compileStylesFor(chip)

    expect(declarationsFor(css, chip)['color']).not.toBe(unpaidColour)
  })
})
