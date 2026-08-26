// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SiteHeader } from '../../../src/components/site-header'
import { renderWithRouter } from '../support/router'
import {
  compileStylesFor,
  declarationsFor,
  lengthInPx,
} from '../support/rendered-styles'

// The bar every page sits under. Consumer navigation and Practitioner business
// share it but never share a region, and the two account states swap one
// cluster for the other rather than growing the bar.

function link(name: string): HTMLElement {
  return screen.getByRole('link', { name })
}

describe('SiteHeader', () => {
  describe('signed out', () => {
    it('is the page banner', async () => {
      await renderWithRouter(<SiteHeader signedIn={false} />)

      expect(screen.getByRole('banner')).toBeDefined()
    })

    it('takes the wordmark home', async () => {
      await renderWithRouter(<SiteHeader signedIn={false} />)

      expect(link('MiCare').getAttribute('href')).toBe('/')
    })

    it('routes a consumer to search', async () => {
      await renderWithRouter(<SiteHeader signedIn={false} />)

      expect(link('Find an optician').getAttribute('href')).toBe('/search')
    })

    it('routes a Practitioner prospect to signup', async () => {
      await renderWithRouter(<SiteHeader signedIn={false} />)

      expect(link('List your Practice').getAttribute('href')).toBe('/signup')
    })

    it('routes a returning Practitioner to sign in', async () => {
      await renderWithRouter(<SiteHeader signedIn={false} />)

      expect(link('Sign in').getAttribute('href')).toBe('/login')
    })

    it('offers no dashboard to someone who is not signed in', async () => {
      await renderWithRouter(<SiteHeader signedIn={false} />)

      expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull()
    })
  })

  describe('signed in', () => {
    it('routes the Practitioner to their dashboard', async () => {
      await renderWithRouter(<SiteHeader signedIn />)

      expect(link('Dashboard').getAttribute('href')).toBe('/dashboard')
    })

    it('collapses signup and sign-in into that one destination', async () => {
      await renderWithRouter(<SiteHeader signedIn />)

      expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull()
      expect(
        screen.queryByRole('link', { name: 'List your Practice' }),
      ).toBeNull()
    })

    it('still routes a signed-in Practitioner to search', async () => {
      await renderWithRouter(<SiteHeader signedIn />)

      expect(link('Find an optician').getAttribute('href')).toBe('/search')
    })
  })

  describe('the bar itself', () => {
    it('sits on surface-deep in inverted ink', async () => {
      const { container } = await renderWithRouter(
        <SiteHeader signedIn={false} />,
      )
      const css = await compileStylesFor(container)
      const declarations = declarationsFor(css, screen.getByRole('banner'))

      expect(declarations['background-color']).toBe('#12332f')
      expect(declarations.color).toBe('#f4efe7')
    })

    it('declares itself on-deep, so focus rings invert against it', async () => {
      await renderWithRouter(<SiteHeader signedIn={false} />)

      expect(screen.getByRole('banner').classList).toContain('on-deep')
    })

    it('gives every link in it a 44px hit target', async () => {
      const { container } = await renderWithRouter(
        <SiteHeader signedIn={false} />,
      )
      const css = await compileStylesFor(container)

      for (const anchor of screen.getAllByRole('link')) {
        expect(
          lengthInPx(declarationsFor(css, anchor)['min-height']),
        ).toBeGreaterThanOrEqual(44)
      }

      cleanup()
    })
  })
})
