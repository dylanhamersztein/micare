// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { VerificationWait } from '../../../src/components/verification-wait'
import { compileStylesFor, declarationsFor } from '../support/rendered-styles'

// The four or five seconds MiCare spends on the register is the whole
// proposition happening in front of the Practitioner, so the wait is a record
// of what is being done rather than a spinner over a greyed page. What these
// tests hold is the honesty of that record: it names the register and the
// number, it never invents a duration or a percentage it cannot know, and it
// announces itself once rather than once per line.

const GOC_NUMBER = '01-31842'

function renderWait() {
  return render(<VerificationWait registrationNumber={GOC_NUMBER} />)
}

/** Every element the component asks assistive technology to announce. */
function liveRegions(container: HTMLElement): Array<Element> {
  return [...container.querySelectorAll('[aria-live]')]
}

describe('VerificationWait', () => {
  it('names the register it is reading', () => {
    renderWait()

    expect(
      screen.getAllByText(/General Optical Council/).length,
    ).toBeGreaterThan(0)
  })

  it('names the number being matched, so the wait shows its working', () => {
    renderWait()

    expect(screen.getAllByText(GOC_NUMBER).length).toBeGreaterThan(0)
  })

  it('sets that number in tabular figures, the way a record cites one', async () => {
    renderWait()

    const [number] = screen.getAllByText(GOC_NUMBER)
    const css = await compileStylesFor(number)

    expect(declarationsFor(css, number)['font-variant-numeric']).toBe(
      'tabular-nums',
    )
  })

  it('lists the three steps of the check in the order they run', () => {
    renderWait()
    const steps = screen.getAllByRole('listitem').map((li) => li.textContent)

    expect(steps).toHaveLength(3)
    expect(steps[0]).toMatch(/Registration number read/)
    expect(steps[1]).toMatch(/Matching/)
    expect(steps[2]).toMatch(/Confirming/)
  })

  it('says each step is done, running or waiting in words, not colour alone', () => {
    renderWait()
    const steps = screen.getAllByRole('listitem').map((li) => li.textContent)

    expect(steps[0]).toMatch(/read/i)
    expect(steps[1]).toMatch(/checking/i)
    expect(steps[2]).toMatch(/waiting/i)
  })

  it('announces the running step once, politely, and not one region per row', () => {
    const { container } = renderWait()
    const [region, ...rest] = liveRegions(container)

    expect(rest).toEqual([])
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(region.textContent).toMatch(/Matching/)
  })

  it('invents no percentage, because the register never tells us one', () => {
    const { container } = renderWait()

    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(container.textContent).not.toMatch(/%/)
  })

  it('hides the one moving thing from assistive technology', () => {
    const { container } = renderWait()
    const spinner = container.querySelector('.animate-spin')

    expect(spinner).not.toBeNull()
    expect(spinner?.getAttribute('aria-hidden')).toBe('true')
  })

  it('promises only what signup actually does — the public register, nothing else', () => {
    const { container } = renderWait()

    expect(container.textContent).toMatch(/public register/)
    // Nothing is persisted until Checkout, so the wait must never tell the
    // Practitioner their answers are saved if they close the tab.
    expect(container.textContent).not.toMatch(/saved/)
  })
})
