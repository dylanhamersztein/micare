import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// This file exercises the GOC_MOCK=false path. env.server.ts reads GOC_MOCK
// once, at first import — so the flag is set BEFORE the dynamic import of
// verification-impl below. Vitest isolates the module registry per test file,
// so this does not affect other suites.
process.env.GOC_MOCK = 'false'
process.env.GOC_API_KEY = 'test-key'

const foundActiveHtml = readFileSync(
  fileURLToPath(new URL('../fixtures/goc/found-active.html', import.meta.url)),
  'utf8',
)

// Must match the registration number shown in found-active.html (see the
// Prerequisites note and tests/unit/goc-register.test.ts).
const FOUND_ACTIVE_NUMBER = 'D-17909'

let verify: typeof import('../../src/server/verification-impl').verify
let db: typeof import('../../src/server/db').db

function htmlResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html' },
  })
}

beforeAll(async () => {
  verify = (await import('../../src/server/verification-impl')).verify
  db = (await import('../../src/server/db')).db
})

describe('verify (GOC scrape path)', () => {
  beforeEach(async () => {
    await db.query('delete from public.verifications where goc_number = $1', [
      FOUND_ACTIVE_NUMBER,
    ])
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('scrapes the GOC register and returns found-active', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(foundActiveHtml))

    const result = await verify('optician', 'Jane Smith', FOUND_ACTIVE_NUMBER)

    expect(result.kind).toBe('found-active')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('serves a second call within 24h from cache without a fresh request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(foundActiveHtml))

    const first = await verify('optician', 'Jane Smith', FOUND_ACTIVE_NUMBER)
    const second = await verify('optician', 'Jane Smith', FOUND_ACTIVE_NUMBER)

    expect(second).toEqual(first)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
