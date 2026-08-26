// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { withUnbrokenFigures } from '../../../src/components/figures'
import { GOC_NUMBER_HELP } from '../../../src/goc-number'
import { compileStylesFor, declarationsFor } from '../support/rendered-styles'

// A registration number offers the browser a break opportunity at its hyphen,
// so `01-31842` wraps as `01-` / `31842` at exactly the width the signup form
// uses. An example of a format, broken across two lines, teaches the wrong
// format — the one field where that matters most is the one that shows it.

describe('withUnbrokenFigures', () => {
  it('leaves the words exactly as they were', () => {
    const { container } = render(<p>{withUnbrokenFigures(GOC_NUMBER_HELP)}</p>)

    expect(container.textContent).toBe(GOC_NUMBER_HELP)
  })

  it('keeps each registration number whole, hyphen and all', async () => {
    const { container } = render(<p>{withUnbrokenFigures(GOC_NUMBER_HELP)}</p>)
    const figures = [...container.querySelectorAll('span')]
    const css = await compileStylesFor(container)

    expect(figures.map((span) => span.textContent)).toEqual([
      '01-31842',
      'D-17909',
    ])
    for (const figure of figures) {
      expect(declarationsFor(css, figure)['white-space']).toBe('nowrap')
    }
  })

  it('passes copy with no figures in it straight through', () => {
    const { container } = render(
      <p>{withUnbrokenFigures('No numbers here.')}</p>,
    )

    expect(container.querySelectorAll('span')).toHaveLength(0)
    expect(container.textContent).toBe('No numbers here.')
  })
})
