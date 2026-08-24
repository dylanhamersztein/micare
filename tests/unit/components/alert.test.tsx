// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { compileStylesFor, declarationsFor } from '../support/rendered-styles'
import { Alert } from '../../../src/components/alert'
import type { AlertTone } from '../../../src/components/alert'

// Same anatomy as the Verification badge — hairline border, tone edge, glyph,
// bold first line, plain second — so an alert reads as the same species of
// object as a Verification record.
const TONE_EDGE: Readonly<Record<AlertTone, string>> = {
  info: '#0d4a45',
  success: '#186a3b',
  warning: '#7a4f00',
  error: '#96301c',
}

// Warning and error interrupt; info and success wait their turn.
const TONE_ROLE: Readonly<Record<AlertTone, string>> = {
  info: 'status',
  success: 'status',
  warning: 'alert',
  error: 'alert',
}

const TONES = Object.keys(TONE_EDGE) as Array<AlertTone>

describe('Alert', () => {
  it('leads with the headline and follows with the detail', () => {
    render(
      <Alert tone="warning" title="Your last payment did not go through">
        Your listing is still visible.
      </Alert>,
    )

    expect(
      screen.getByText('Your last payment did not go through'),
    ).toBeDefined()
    expect(screen.getByText('Your listing is still visible.')).toBeDefined()
  })

  it('stands on its headline alone', () => {
    render(<Alert tone="info" title="Results are ordered by distance" />)

    expect(screen.getByText('Results are ordered by distance')).toBeDefined()
  })

  for (const tone of TONES) {
    it(`announces ${tone} as ${TONE_ROLE[tone]}`, () => {
      render(<Alert tone={tone} title="Something happened" />)

      expect(screen.getByRole(TONE_ROLE[tone])).toBeDefined()
    })

    it(`paints the ${tone} edge in its own tone`, async () => {
      const { container } = render(
        <Alert tone={tone} title="Something happened" />,
      )
      const alert = container.firstElementChild!
      const css = await compileStylesFor(alert)

      expect(declarationsFor(css, alert)['border-left-color']).toBe(
        TONE_EDGE[tone],
      )
    })
  }

  it('gives each tone its own glyph, so the tone is never colour alone', () => {
    const glyphs = TONES.map((tone) => {
      const { container } = render(
        <Alert tone={tone} title="Something happened" />,
      )

      return container.querySelector('svg')!.innerHTML
    })

    expect(new Set(glyphs).size).toBe(TONES.length)
  })

  it('hides the glyph from assistive technology, which already hears the role', () => {
    const { container } = render(
      <Alert tone="error" title="We could not save your profile" />,
    )

    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe(
      'true',
    )
  })

  it('carries markup in its detail, so a retry deadline can hold a link', () => {
    render(
      <Alert tone="warning" title="Your last payment did not go through">
        We will retry until 25/08/2026 — you can also{' '}
        <a href="#billing">update your card now</a>.
      </Alert>,
    )

    expect(
      screen.getByRole('link', { name: 'update your card now' }),
    ).toBeDefined()
  })
})
