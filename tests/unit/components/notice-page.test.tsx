// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { NoticePage } from '../../../src/components/notice-page'
import { compileStylesFor, declarationsFor } from '../support/rendered-styles'

// The six screens that are the end of a journey rather than a step in one: a
// confirmed Notify-Me Subscription, an unsubscribed one, either token page
// handed a link it cannot read, and the two dead ends on a Practitioner
// profile. Each says one thing, explains it, and offers one way onward.
describe('NoticePage', () => {
  it('states the outcome as the page heading', () => {
    render(
      <NoticePage tone="affirm" eyebrow="Confirmed" title="You're on the list">
        <p>Body copy.</p>
      </NoticePage>,
    )

    expect(
      screen.getByRole('heading', { level: 1, name: "You're on the list" }),
    ).toBeDefined()
  })

  it("carries the caller's marker on its root, so the E2E suite still finds it", () => {
    render(
      <NoticePage
        tone="affirm"
        eyebrow="Confirmed"
        title="You're on the list"
        data-testid="notify-confirmed"
      >
        <p>Body copy.</p>
      </NoticePage>,
    )

    expect(screen.getByTestId('notify-confirmed').textContent).toContain(
      'Body copy.',
    )
  })

  it('states the outcome in a word as well as a colour, with its own glyph', () => {
    const { container } = render(
      <NoticePage
        tone="problem"
        eyebrow="Link not recognised"
        title="This link didn't work"
      >
        <p>Body copy.</p>
      </NoticePage>,
    )

    expect(screen.getByText('Link not recognised')).toBeDefined()
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('gives the two tones different glyphs, so the chip is never colour alone', () => {
    const glyphs = (['affirm', 'problem'] as const).map((tone) => {
      const { container } = render(
        <NoticePage tone={tone} eyebrow="Outcome" title="Title">
          <p>Body copy.</p>
        </NoticePage>,
      )

      return container.querySelector('svg')!.innerHTML
    })

    expect(new Set(glyphs).size).toBe(2)
  })

  it('sets the heading in the serif face at the h1 step, like every other page title', async () => {
    render(
      <NoticePage tone="affirm" eyebrow="Confirmed" title="You're on the list">
        <p>Body copy.</p>
      </NoticePage>,
    )

    const heading = screen.getByRole('heading', { level: 1 })
    const css = await compileStylesFor(heading)
    const declarations = declarationsFor(css, heading)

    expect(declarations['font-size']).toBe('2.125rem')
    expect(declarations['font-family']).toContain('Newsreader Variable')
  })
})
