// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { pxAtDefaultRoot } from '../support/design-system'
import {
  compileStylesFor,
  declarationsFor,
  lengthInPx,
  variantDeclarations,
} from '../support/rendered-styles'
import { SegmentedRadio } from '../../../src/components/segmented-radio'

const RADIUS_OPTIONS = [
  { value: 5, label: '5 miles' },
  { value: 10, label: '10 miles' },
  { value: 15, label: '15 miles' },
]

function renderRadius(
  value: number,
  onChange: (next: number) => void = () => {},
) {
  return render(
    <SegmentedRadio
      legend="Search radius"
      name="radiusMiles"
      options={RADIUS_OPTIONS}
      value={value}
      onChange={onChange}
    />,
  )
}

/** The label element wrapping a given segment's radio. */
function segment(container: HTMLElement, label: string): HTMLLabelElement {
  const found = [...container.querySelectorAll('label')].find(
    (element) => element.textContent === label,
  )

  if (found === undefined) throw new Error(`no segment labelled "${label}"`)

  return found
}

describe('SegmentedRadio', () => {
  it('groups its segments under the legend', () => {
    renderRadius(10)

    expect(screen.getByRole('group', { name: 'Search radius' })).toBeDefined()
  })

  it('renders one native radio per option, each labelled by its segment', () => {
    renderRadius(10)

    for (const option of RADIUS_OPTIONS) {
      expect(screen.getByRole('radio', { name: option.label })).toBeDefined()
    }
  })

  it('shares one name across the group, so the radios are one choice', () => {
    const { container } = renderRadius(10)
    const names = [...container.querySelectorAll('input')].map(
      (input) => input.name,
    )

    expect(names).toEqual(['radiusMiles', 'radiusMiles', 'radiusMiles'])
  })

  it('checks the segment matching the current value', () => {
    renderRadius(10)

    expect(
      screen.getByRole<HTMLInputElement>('radio', { name: '10 miles' }).checked,
    ).toBe(true)
    expect(
      screen.getByRole<HTMLInputElement>('radio', { name: '5 miles' }).checked,
    ).toBe(false)
  })

  it('reports the picked value, not the DOM string', () => {
    const picked: Array<number> = []
    renderRadius(10, (next) => picked.push(next))

    fireEvent.click(screen.getByRole('radio', { name: '15 miles' }))

    expect(picked).toEqual([15])
  })

  it('marks the selected segment with a tick as well as a fill, so state is never colour alone', () => {
    const { container } = renderRadius(10)

    expect(segment(container, '10 miles').querySelector('svg')).not.toBeNull()
    expect(segment(container, '5 miles').querySelector('svg')).toBeNull()
  })

  it('hides the tick from assistive technology, which already hears "checked"', () => {
    const { container } = renderRadius(10)

    expect(
      segment(container, '10 miles')
        .querySelector('svg')!
        .getAttribute('aria-hidden'),
    ).toBe('true')
  })

  it('keeps each radio inside the segment it belongs to', () => {
    const { container } = renderRadius(10)

    for (const option of RADIUS_OPTIONS) {
      const label = segment(container, option.label)

      expect(label.querySelector('input[type="radio"]')).not.toBeNull()
    }
  })

  describe('focus', () => {
    it('draws the ring around the segment rather than the hidden radio', async () => {
      const { container } = renderRadius(10)
      const label = segment(container, '5 miles')
      const css = await compileStylesFor(label)
      const focused = variantDeclarations(css, label, 'has-[:focus-visible]')

      expect(focused['outline-width']).toBe('3px')
      expect(focused['outline-color']).toBe('#0d4a45')
    })

    it('insets the ring, so it is not clipped by the segments butted against it', async () => {
      const { container } = renderRadius(10)
      const label = segment(container, '5 miles')
      const css = await compileStylesFor(label)
      const focused = variantDeclarations(css, label, 'has-[:focus-visible]')

      expect(lengthInPx(focused['outline-offset'])).toBeLessThan(0)
    })

    it('gives the segment a positioned ancestor, so the absolutely positioned radio cannot drag the ring outside it', async () => {
      const { container } = renderRadius(10)
      const label = segment(container, '5 miles')
      const css = await compileStylesFor(label)

      expect(declarationsFor(css, label)['position']).toBe('relative')
    })
  })

  it('gives every segment at least a 44px hit target', async () => {
    const { container } = renderRadius(10)
    const label = segment(container, '5 miles')
    const css = await compileStylesFor(label)

    expect(
      pxAtDefaultRoot(declarationsFor(css, label)['min-height']),
    ).toBeGreaterThanOrEqual(44)
  })

  // At 390px the three segments get about 106px each. The selected one also
  // carries a tick, and with the roomier padding "5 miles" broke onto a second
  // line — doubling the height of the row it sits in.
  it('keeps a segment label on one line once the tick is beside it', async () => {
    const { container } = renderRadius(5)
    const selected = container.querySelector('label')!
    const css = await compileStylesFor(selected)

    expect(declarationsFor(css, selected)['white-space']).toBe('nowrap')
  })
})
