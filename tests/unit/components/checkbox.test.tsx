// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Checkbox } from '../../../src/components/checkbox'
import {
  compileStylesFor,
  declarationsFor,
  lengthInPx,
} from '../support/rendered-styles'

// Design section 07: a 24px box in a 44px row, and the whole row is both the
// label and the hit target — not a small square with words beside it that miss
// when a thumb lands on them.

describe('Checkbox', () => {
  it('makes the whole row the label, so the words toggle it too', () => {
    render(<Checkbox label="Currently accepting new patients" />)

    const box = screen.getByRole('checkbox', {
      name: 'Currently accepting new patients',
    })

    expect(box.closest('label')).not.toBeNull()
  })

  it('gives the row the 44px a thumb needs', async () => {
    const { container } = render(<Checkbox label="Accepting new patients" />)
    const row = container.querySelector('label')!
    const css = await compileStylesFor(row)

    expect(
      lengthInPx(declarationsFor(css, row)['min-height']),
    ).toBeGreaterThanOrEqual(44)
  })

  it('draws the box at the design’s 24px', async () => {
    const { container } = render(<Checkbox label="Accepting new patients" />)
    const box = container.querySelector('input')!
    const css = await compileStylesFor(box)

    expect(lengthInPx(declarationsFor(css, box)['width'])).toBe(24)
  })

  it('passes the caller’s attributes through to the control itself', () => {
    render(
      <Checkbox
        label="Accepting new patients"
        checked
        onChange={() => {}}
        data-testid="profile-accepting-new-patients"
      />,
    )

    const box = screen.getByTestId('profile-accepting-new-patients')

    expect(box.tagName).toBe('INPUT')
    expect((box as HTMLInputElement).checked).toBe(true)
  })

  it('carries a line of help where the row needs explaining', () => {
    render(
      <Checkbox
        label="Accepting new patients"
        help="Shown on your listing. Turn it off when you are full."
      />,
    )

    expect(
      screen.getByText('Shown on your listing. Turn it off when you are full.'),
    ).toBeDefined()
  })
})
