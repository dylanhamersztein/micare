// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatusReadout } from '../../../src/components/status-readout'
import {
  compileStylesFor,
  declarationsFor,
  lengthInPx,
} from '../support/rendered-styles'

// Design section 14: a caps label, one large tabular figure, and at most one
// line of context. The tile that justifies the £29 takes the sand ground and
// the 48px figure; every other tile on the dashboard stays on white.

describe('StatusReadout', () => {
  it('pairs the label with its value as a description list entry', () => {
    render(<StatusReadout label="Click-throughs" figure="1,284" />)

    expect(screen.getByText('Click-throughs').tagName).toBe('DT')
    expect(screen.getByText('1,284').closest('dd')).not.toBeNull()
  })

  it('sets a figure at the design’s 48px, in tabular figures', async () => {
    render(<StatusReadout label="Click-throughs" figure="1,284" />)
    const figure = screen.getByText('1,284')
    const css = await compileStylesFor(figure)
    const declarations = declarationsFor(css, figure)

    expect(lengthInPx(declarations['font-size'])).toBe(48)
    expect(declarations['font-variant-numeric']).toBe('tabular-nums')
  })

  it('puts the emphasised tile on the sand ground', async () => {
    const { container } = render(
      <StatusReadout label="Click-throughs" figure="1,284" emphasis />,
    )
    const tile = container.firstElementChild!
    const css = await compileStylesFor(tile)

    expect(declarationsFor(css, tile)['background-color']).toBe('#f2e9da')
  })

  it('leaves every other tile on white', async () => {
    const { container } = render(
      <StatusReadout label="Profile views" figure="3,910" />,
    )
    const tile = container.firstElementChild!
    const css = await compileStylesFor(tile)

    expect(declarationsFor(css, tile)['background-color']).toBe('#ffffff')
  })

  it('reports a state rather than a figure when given one', () => {
    render(
      <StatusReadout label="Subscription" context="£29 a month.">
        <span>Active</span>
      </StatusReadout>,
    )

    expect(screen.getByText('Active').closest('dd')).not.toBeNull()
    expect(screen.getByText('£29 a month.')).toBeDefined()
  })

  // Never two figures in one tile: a tile handed both a figure and a state
  // would report two things and the caps label could only name one.
  it('shows the figure and ignores nothing else when both are given', () => {
    render(
      <StatusReadout label="Click-throughs" figure="0">
        <span>Active</span>
      </StatusReadout>,
    )

    expect(screen.queryByText('Active')).toBeNull()
  })
})
