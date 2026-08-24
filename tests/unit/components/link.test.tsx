// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  STANDALONE_LINK_CLASSES,
  TEXT_LINK_CLASSES,
} from '../../../src/components/link'
import {
  compileStylesFor,
  declarationsFor,
  lengthInPx,
} from '../support/rendered-styles'

// Not a component: a route reaches a Practitioner profile through TanStack's
// own `Link`, which takes a className but is not an `<a>` we can wrap. The
// chrome is therefore shared as classes, the way form controls share
// CONTROL_CLASSES.
describe('a text link', () => {
  it('is coloured and underlined, so it survives greyscale', async () => {
    render(
      <a href="/search" className={TEXT_LINK_CLASSES}>
        Back to search
      </a>,
    )

    const link = screen.getByRole('link')
    const css = await compileStylesFor(link)
    const declarations = declarationsFor(css, link)

    expect(declarations['color']).toBe('#0d4a45')
    expect(declarations['text-decoration-line']).toBe('underline')
  })

  it('clears the 44px touch floor where it stands alone as a page action', async () => {
    render(
      <a href="/search" className={STANDALONE_LINK_CLASSES}>
        Back to search
      </a>,
    )

    const link = screen.getByRole('link')
    const css = await compileStylesFor(link)
    const declarations = declarationsFor(css, link)

    expect(lengthInPx(declarations['min-height'])).toBeGreaterThanOrEqual(44)
  })
})
