// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { VerificationBadge } from '../../../src/components/verification-badge'
import type { VerificationStatus } from '../../../src/visibility'

const STATUSES: ReadonlyArray<VerificationStatus> = [
  'verified',
  'pending',
  'rejected',
  'revoked',
]

// The words each status puts on the plaque. Only `verified` is ever public;
// the other three appear on the practitioner's own dashboard and in signup.
const STATUS_HEADLINE: Readonly<Record<VerificationStatus, string>> = {
  verified: 'Verified optometrist',
  pending: 'Verification pending',
  rejected: 'Not found on the register',
  revoked: 'Registration revoked',
}

const CHECKED_ON = new Date('2026-08-11T09:00:00Z')
const REGISTRATION = '01-31842'

/** Any date in the dd/mm/yyyy form the badge prints. */
const A_DATE = /\d{2}\/\d{2}\/\d{4}/

function label(): string {
  return screen.getByRole('group').getAttribute('aria-label') ?? ''
}

describe('VerificationBadge', () => {
  describe('the verified plaque', () => {
    it('names the profession rather than a hardcoded word', () => {
      render(
        <VerificationBadge
          status="verified"
          profession="dispensing optician"
          registrationNumber={REGISTRATION}
          lastCheckedAt={CHECKED_ON}
        />,
      )

      expect(screen.getByText('Verified dispensing optician')).toBeDefined()
    })

    it('shows the registration number, which is the evidence', () => {
      render(
        <VerificationBadge
          status="verified"
          profession="optometrist"
          registrationNumber={REGISTRATION}
          lastCheckedAt={CHECKED_ON}
        />,
      )

      expect(screen.getByText(REGISTRATION)).toBeDefined()
    })

    it('cites the register by name', () => {
      const { container } = render(
        <VerificationBadge
          status="verified"
          profession="optometrist"
          registrationNumber={REGISTRATION}
          lastCheckedAt={CHECKED_ON}
        />,
      )

      expect(container.textContent).toContain('General Optical Council')
    })

    it('prints the check date in the day-first form a UK reader expects', () => {
      const { container } = render(
        <VerificationBadge
          status="verified"
          profession="optometrist"
          registrationNumber={REGISTRATION}
          lastCheckedAt={CHECKED_ON}
        />,
      )

      expect(container.textContent).toContain('11/08/2026')
    })

    it('states the re-check cadence alongside the date', () => {
      const { container } = render(
        <VerificationBadge
          status="verified"
          profession="optometrist"
          registrationNumber={REGISTRATION}
          lastCheckedAt={CHECKED_ON}
        />,
      )

      expect(container.textContent).toContain('re-checked weekly')
    })

    it('announces the whole record as one statement', () => {
      render(
        <VerificationBadge
          status="verified"
          profession="optometrist"
          registrationNumber={REGISTRATION}
          lastCheckedAt={CHECKED_ON}
        />,
      )

      expect(label()).toBe(
        'Verification: verified. General Optical Council 01-31842. Checked 11/08/2026.',
      )
    })

    it('hides the shield from assistive technology, which is hearing the words', () => {
      const { container } = render(
        <VerificationBadge
          status="verified"
          profession="optometrist"
          registrationNumber={REGISTRATION}
          lastCheckedAt={CHECKED_ON}
        />,
      )

      expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe(
        'true',
      )
    })
  })

  describe('with no last-checked date', () => {
    it('replaces the date line with the cadence — never an empty slot, never a fabricated date', () => {
      const { container } = render(
        <VerificationBadge
          status="verified"
          profession="optometrist"
          registrationNumber={REGISTRATION}
        />,
      )

      expect(container.textContent).toContain('Checked weekly')
      expect(container.textContent).not.toMatch(A_DATE)
    })

    it('links to the method instead', () => {
      render(
        <VerificationBadge
          status="verified"
          profession="optometrist"
          registrationNumber={REGISTRATION}
        />,
      )

      expect(
        screen.getByRole('link', { name: 'how Verification works' }),
      ).toBeDefined()
    })

    it('drops the date from its label too — a label must never name a date the variant does not hold', () => {
      render(
        <VerificationBadge
          status="verified"
          profession="optometrist"
          registrationNumber={REGISTRATION}
        />,
      )

      expect(label()).not.toMatch(A_DATE)
      expect(label()).toBe(
        'Verification: verified. General Optical Council 01-31842. Checked weekly against the register.',
      )
    })
  })

  describe('inline, inside a search result', () => {
    it('shrinks to the single word, because the header states the cadence once for the whole list', () => {
      const { container } = render(
        <VerificationBadge
          variant="inline"
          status="verified"
          profession="optometrist"
          registrationNumber={REGISTRATION}
          lastCheckedAt={CHECKED_ON}
        />,
      )

      expect(container.textContent).toBe('Verified')
    })

    it('still carries the whole record in its label', () => {
      render(
        <VerificationBadge
          variant="inline"
          status="verified"
          profession="optometrist"
          registrationNumber={REGISTRATION}
          lastCheckedAt={CHECKED_ON}
        />,
      )

      expect(label()).toBe(
        'Verification: verified. General Optical Council 01-31842. Checked 11/08/2026.',
      )
    })

    it('keeps the shield, so the mark is not colour alone at small sizes', () => {
      const { container } = render(
        <VerificationBadge
          variant="inline"
          status="verified"
          profession="optometrist"
          registrationNumber={REGISTRATION}
        />,
      )

      expect(container.querySelector('svg')).not.toBeNull()
    })
  })

  describe('every status', () => {
    function renderStatus(
      status: VerificationStatus,
      lastCheckedAt?: Date,
      variant?: 'plaque' | 'inline',
    ) {
      return render(
        <VerificationBadge
          variant={variant}
          status={status}
          profession="optometrist"
          registrationNumber={REGISTRATION}
          lastCheckedAt={lastCheckedAt}
        />,
      )
    }

    for (const status of STATUSES) {
      it(`states ${status} in words, so the meaning never rides on colour alone`, () => {
        renderStatus(status, CHECKED_ON)

        expect(screen.getByText(STATUS_HEADLINE[status])).toBeDefined()
      })

      it(`names ${status} in its label`, () => {
        renderStatus(status, CHECKED_ON)

        expect(label().startsWith(`Verification: ${status}.`)).toBe(true)
      })

      it(`prints the date it was given for ${status}`, () => {
        const { container } = renderStatus(status, CHECKED_ON)

        expect(container.textContent).toContain('11/08/2026')
        expect(label()).toContain('11/08/2026')
      })

      it(`names no date for ${status} when it holds none`, () => {
        const { container } = renderStatus(status)

        expect(container.textContent).not.toMatch(A_DATE)
        expect(label()).not.toMatch(A_DATE)
      })

      it(`drops the date from the inline ${status} badge but keeps it in the label`, () => {
        const { container } = renderStatus(status, CHECKED_ON, 'inline')

        expect(container.textContent).not.toMatch(A_DATE)
        expect(label()).toContain('11/08/2026')
      })
    }

    it('gives each status its own glyph, so four badges are never one shape in four colours', () => {
      const glyphs = STATUSES.map((status) => {
        const { container } = renderStatus(status, CHECKED_ON)

        return container.querySelector('svg')!.innerHTML
      })

      expect(new Set(glyphs).size).toBe(STATUSES.length)
    })
  })
})
