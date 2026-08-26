import { describe, expect, it } from 'vitest'

import { SITE_DESCRIPTION, SITE_TITLE } from '../../src/shell-metadata'

// The document's default title and description. Per-route overrides arrive
// with the SEO slice; these are what every page falls back to, so they have to
// be MiCare's own words and they have to survive a search result listing them.

describe('SITE_TITLE', () => {
  it('names the company', () => {
    expect(SITE_TITLE).toContain('MiCare')
  })

  it('says what the site is for beyond the name', () => {
    expect(SITE_TITLE.replace('MiCare', '').trim().length).toBeGreaterThan(0)
  })

  it('fits a search result without being cut off', () => {
    expect(SITE_TITLE.length).toBeLessThanOrEqual(60)
  })
})

describe('SITE_DESCRIPTION', () => {
  it('states the promise the directory is built on', () => {
    expect(SITE_DESCRIPTION).toMatch(/paid placement/i)
  })

  it('names the register the listings are checked against', () => {
    expect(SITE_DESCRIPTION).toMatch(/General Optical Council|GOC/)
  })

  it('fits a search result without being truncated', () => {
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(160)
    expect(SITE_DESCRIPTION.length).toBeGreaterThanOrEqual(70)
  })
})

describe('neither', () => {
  it('carries the scaffold the shell was generated from', () => {
    expect(`${SITE_TITLE} ${SITE_DESCRIPTION}`).not.toContain('TanStack')
  })
})
