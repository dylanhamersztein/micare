// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { Wordmark } from '../../../src/components/wordmark'
import {
  compileStylesFor,
  declarationsFor,
  lengthInPx,
} from '../support/rendered-styles'

// The mark is a weight change, not a logo: one word of the serif with `Mi` at
// 600 against `Care` at 400. Nothing here is an image, which is why it can be
// asked to render at 24px in a header without a second asset.

let css: string
let mark: HTMLElement

beforeAll(async () => {
  const { container } = render(<Wordmark />)
  css = await compileStylesFor(container)
  cleanup()
})

beforeEach(() => {
  // The mark has no text node of its own — the two weights are its children —
  // so it is reached as the element rather than by its words.
  mark = render(<Wordmark />).container.firstElementChild as HTMLElement
})

describe('Wordmark', () => {
  it('reads as the one word MiCare, not as Mi and Care', () => {
    expect(mark.textContent).toBe('MiCare')
  })

  it('breaks the weight at the syllable — Mi at 600, Care at 400', () => {
    expect(declarationsFor(css, screen.getByText('Mi'))['font-weight']).toBe(
      '600',
    )
    expect(declarationsFor(css, screen.getByText('Care'))['font-weight']).toBe(
      '400',
    )
  })

  it('sets the mark in the serif face', () => {
    expect(declarationsFor(css, mark)['font-family']).toContain('Newsreader')
  })

  it('renders at the 24px header lockup, tracked in and set solid', () => {
    const declarations = declarationsFor(css, mark)

    expect(lengthInPx(declarations['font-size'])).toBe(24)
    expect(declarations['letter-spacing']).toBe('-0.01em')
    expect(declarations['line-height']).toBe('1')
  })
})
