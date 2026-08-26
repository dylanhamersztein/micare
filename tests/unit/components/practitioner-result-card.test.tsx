// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PractitionerResultCard } from '../../../src/components/practitioner-result-card'
import {
  compileStylesFor,
  declarationsFor,
  lengthInPx,
  variantDeclarations,
} from '../support/rendered-styles'

import type { SearchResult } from '../../../src/search-input'

const RESULT: SearchResult = {
  id: '11111111-1111-1111-1111-111111111111',
  shortId: 'a1b2c3d4',
  fullName: 'Ravi Chandrasekaran',
  practiceName: 'Chandra Opticians',
  practiceAddressLine1: '14 Bridge Street',
  practiceTown: 'Bath',
  practicePostcode: 'BA2 4AS',
  bookingLinkUrl: 'https://chandra.example.co.uk/book',
  acceptingNewPatients: true,
  distanceMiles: 1.24,
}

describe('PractitionerResultCard', () => {
  function renderInList(result: SearchResult = RESULT) {
    return render(<PractitionerResultCard result={result} />, {
      container: document.body.appendChild(document.createElement('ul')),
    })
  }

  it('is one link to the Practitioner profile, so nothing competes with the row', () => {
    renderInList()

    expect(
      screen
        .getByRole('link', { name: /Ravi Chandrasekaran/ })
        .getAttribute('href'),
    ).toBe('/p/a1b2c3d4/ravi-chandrasekaran-chandra-opticians-bath')
  })

  it('rounds the distance to one decimal, because a metre of precision is noise', () => {
    renderInList()

    expect(screen.getByText('1.2 miles')).toBeDefined()
  })

  it('sets the distance in tabular figures, so a column of them lines up', async () => {
    renderInList()

    const distance = screen.getByText('1.2 miles')
    const css = await compileStylesFor(distance)

    expect(declarationsFor(css, distance)['font-variant-numeric']).toBe(
      'tabular-nums',
    )
  })

  it('names the Practice under the Practitioner, then the address as one line', () => {
    renderInList()

    expect(screen.getByText('Chandra Opticians')).toBeDefined()
    expect(screen.getByText('14 Bridge Street, Bath, BA2 4AS')).toBeDefined()
  })

  it('drops the Practice name rather than leaving a gap where one is missing', () => {
    const { container } = renderInList({ ...RESULT, practiceName: null })

    expect(container.textContent).not.toContain('Chandra Opticians')
    expect(screen.getByText('14 Bridge Street, Bath, BA2 4AS')).toBeDefined()
  })

  // Everything a search returns is verified — that is what made it visible —
  // so the row says so with the shared badge rather than a bespoke green span.
  it('carries the shared Verification badge, not a green span of its own', () => {
    renderInList()

    const badge = screen.getByRole('group')

    expect(badge.textContent).toBe('Verified')
    expect(badge.getAttribute('aria-label')).toContain(
      'General Optical Council',
    )
    expect(badge.querySelector('svg')).not.toBeNull()
  })

  it('states whether the Practitioner is accepting new patients, in words', () => {
    renderInList()

    expect(screen.getByText('Accepting new patients')).toBeDefined()
  })

  it('states the closed door just as plainly', () => {
    renderInList({ ...RESULT, acceptingNewPatients: false })

    expect(screen.getByText('Not accepting new patients')).toBeDefined()
  })

  describe('as a row in a register page', () => {
    // The rule belongs to the row, not to the link inside it: a `last:`
    // variant on the link always matches — it is the only child of its row —
    // so every result would lose its hairline instead of only the final one.
    it('is a row in the list, and the row carries the hairline', async () => {
      render(<PractitionerResultCard result={RESULT} />, {
        container: document.body.appendChild(document.createElement('ul')),
      })

      const row = screen.getByRole('listitem')
      const css = await compileStylesFor(row)
      const declarations = declarationsFor(css, row)

      expect(lengthInPx(declarations['border-bottom-width'])).toBe(1)
      expect(declarations['border-color']).toBe('#efe9df')
      expect(
        lengthInPx(
          variantDeclarations(css, row, 'last')['border-bottom-width'],
        ),
      ).toBe(0)
    })

    it('warms under the pointer, so the whole row reads as the target', async () => {
      render(<PractitionerResultCard result={RESULT} />, {
        container: document.body.appendChild(document.createElement('ul')),
      })

      const link = screen.getByRole('link')
      const css = await compileStylesFor(link)

      expect(variantDeclarations(css, link, 'hover')['background-color']).toBe(
        '#fbf8f3',
      )
    })

    it('takes the marker the E2E suite navigates the row by', () => {
      render(
        <PractitionerResultCard
          result={RESULT}
          data-testid="search-result-a1b2c3d4"
        />,
        { container: document.body.appendChild(document.createElement('ul')) },
      )

      expect(screen.getByTestId('search-result-a1b2c3d4').tagName).toBe('LI')
    })
  })
})
