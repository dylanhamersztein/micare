// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SiteFooter } from '../../../src/components/site-footer'
import { renderWithRouter } from '../support/router'
import {
  compileStylesFor,
  declarationsFor,
  lengthInPx,
} from '../support/rendered-styles'

// The footer is where the site states its own terms of trade — the "no paid
// placement" sentence lives here permanently rather than as a line of
// marketing on the homepage.

function link(name: string | RegExp): HTMLElement {
  return screen.getByRole('link', { name })
}

describe('SiteFooter', () => {
  it('is the page contentinfo', async () => {
    await renderWithRouter(<SiteFooter />)

    expect(screen.getByRole('contentinfo')).toBeDefined()
  })

  it('carries the wordmark', async () => {
    await renderWithRouter(<SiteFooter />)

    expect(screen.getByRole('contentinfo').textContent).toContain('MiCare')
  })

  it('states that nothing on MiCare is a paid placement', async () => {
    await renderWithRouter(<SiteFooter />)

    expect(
      screen.getByText(/Nothing on MiCare is a paid placement/),
    ).toBeDefined()
  })

  it('names the company and its registration', async () => {
    await renderWithRouter(<SiteFooter />)

    expect(
      screen.getByText(/MiCare Ltd · Registered in England and Wales 15482910/),
    ).toBeDefined()
  })

  it('routes a consumer to search', async () => {
    await renderWithRouter(<SiteFooter />)

    expect(link('Find an optician').getAttribute('href')).toBe('/search')
  })

  it('carries the Practitioner offer at its price', async () => {
    await renderWithRouter(<SiteFooter />)

    expect(link(/List your Practice — £29\/month/).getAttribute('href')).toBe(
      '/signup',
    )
  })

  it('routes a returning Practitioner to sign in', async () => {
    await renderWithRouter(<SiteFooter />)

    expect(link('Sign in').getAttribute('href')).toBe('/login')
  })

  it('puts the consumer column ahead of the Practitioner one in the document', async () => {
    // Reading order is the consumer's; the Practitioner offer is promoted
    // above it on a narrow screen in CSS, because that is the only place it
    // appears there.
    await renderWithRouter(<SiteFooter />)

    expect(
      screen
        .getAllByRole('navigation')
        .map((nav) => nav.getAttribute('aria-label')),
    ).toEqual(['Find care', 'For Practitioners'])
  })

  describe('the legal slot', () => {
    it('stays empty while there are no legal pages to link', async () => {
      await renderWithRouter(<SiteFooter />)

      expect(screen.queryByTestId('footer-legal')).toBeNull()
    })

    it('lists the legal pages once they exist', async () => {
      await renderWithRouter(
        <SiteFooter
          legalLinks={[
            { label: 'Privacy policy', href: '/privacy' },
            { label: 'Terms', href: '/terms' },
          ]}
        />,
      )

      expect(link('Privacy policy').getAttribute('href')).toBe('/privacy')
      expect(link('Terms').getAttribute('href')).toBe('/terms')
    })
  })

  describe('the ground it sits on', () => {
    it('sits on surface-deep in inverted ink', async () => {
      const { container } = await renderWithRouter(<SiteFooter />)
      const css = await compileStylesFor(container)
      const declarations = declarationsFor(css, screen.getByRole('contentinfo'))

      expect(declarations['background-color']).toBe('#12332f')
      expect(declarations.color).toBe('#f4efe7')
    })

    it('declares itself on-deep, so focus rings invert against it', async () => {
      await renderWithRouter(<SiteFooter />)

      expect(screen.getByRole('contentinfo').classList).toContain('on-deep')
    })

    it('gives every link in it a 44px hit target', async () => {
      const { container } = await renderWithRouter(<SiteFooter />)
      const css = await compileStylesFor(container)

      for (const anchor of screen.getAllByRole('link')) {
        expect(
          lengthInPx(declarationsFor(css, anchor)['min-height']),
        ).toBeGreaterThanOrEqual(44)
      }
    })
  })
})
