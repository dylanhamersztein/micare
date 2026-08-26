import { readFile } from 'node:fs/promises'

import { beforeAll, describe, expect, it } from 'vitest'

import { SITE_DESCRIPTION, SITE_TITLE } from '../../src/shell-metadata'
import { routeSource, stockPaletteUtilities } from './support/route-source'

// The root route is the one route no rendered test can mount: it is the
// document itself, and what matters about it — what it puts in the head, what
// it wraps every page in, and what it leaves out of a production build — is
// visible in the source and nowhere else.

let source: string

beforeAll(async () => {
  source = await routeSource('__root.tsx')
})

describe('the document head', () => {
  it('keeps nothing of the scaffold the app was generated from', () => {
    expect(source).not.toContain('TanStack Start Starter')
  })

  it('takes its title from MiCare rather than typing one out', () => {
    expect(source).toContain('SITE_TITLE')
    expect(SITE_TITLE).not.toBe('')
  })

  it('carries a meta description', () => {
    expect(source).toMatch(/name:\s*'description'/)
    expect(source).toContain('SITE_DESCRIPTION')
    expect(SITE_DESCRIPTION).not.toBe('')
  })
})

describe('the shell', () => {
  it('wraps every page in the header', () => {
    expect(source).toContain('<SiteHeader')
  })

  it('wraps every page in the footer', () => {
    expect(source).toContain('<SiteFooter')
  })

  it('reads the session at the root, so the header knows who is looking', () => {
    expect(source).toContain('readShellSession')
    expect(source).toMatch(/loader:/)
  })

  it('reaches for MiCare tokens, never the stock Tailwind palette', () => {
    expect(stockPaletteUtilities(source)).toEqual([])
  })
})

describe('the devtools panel', () => {
  it('is removed from a production build by the devtools plugin', async () => {
    const config = await readFile(
      new URL('../../vite.config.ts', import.meta.url),
      'utf8',
    )

    expect(config).toContain("from '@tanstack/devtools-vite'")
    expect(config).toMatch(/plugins:\s*\[\s*devtools\(\)/)
  })

  it('is left unwrapped in the shell, which is what that plugin can remove', () => {
    // The plugin deletes the element outright. Behind a condition it leaves an
    // empty conditional behind instead, and the build stops parsing — so this
    // guard is here to explain the failure before babel has to.
    expect(source).toMatch(/\n\s*<TanStackDevtools/)
  })
})

describe('signing out', () => {
  it('invalidates the router, so the header stops offering the dashboard', async () => {
    // The shell reads the session in the root loader, and a client-side
    // navigation does not re-run it. Without the invalidation the Practitioner
    // lands on /login still being offered a dashboard they no longer have.
    const dashboard = await routeSource('dashboard.tsx')

    expect(dashboard).toMatch(
      /await signOut\(\)[\s\S]{0,400}router\.invalidate\(\)/,
    )
  })
})
