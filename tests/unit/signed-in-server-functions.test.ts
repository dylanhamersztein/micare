import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// Every server function that acts *as* a Practitioner has one thing in
// common: the Practitioner it acts as comes from the sealed `micare_session`
// cookie (ADR-0006), never from something the caller typed. A createServerFn
// handler cannot be invoked outside a request, so — like the route guards in
// support/route-source.ts — the source is what the guard reads.

const SERVER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src/server',
)

/** The wrappers that speak for a signed-in Practitioner. */
const SIGNED_IN_SERVER_FUNCTIONS = [
  'dashboard.ts',
  'billing-portal.ts',
  'profile-load.ts',
  'profile-update.ts',
  'photo-upload.ts',
] as const

function serverSource(file: string): Promise<string> {
  return readFile(path.join(SERVER, file), 'utf8')
}

describe.each(SIGNED_IN_SERVER_FUNCTIONS)('%s', (file) => {
  it('resolves the Practitioner from the session', async () => {
    expect(await serverSource(file)).toContain('await readSession()')
  })

  it('has an unauthenticated result for the caller who has no session', async () => {
    expect(await serverSource(file)).toContain("kind: 'unauthenticated'")
  })

  // short_id is public: it is in every /p/<short_id>/<slug> URL and every
  // /go?p=<short_id> link. Accepting one as input is accepting whoever the
  // caller says they are.
  it('never takes a Practitioner identifier from the caller', async () => {
    const source = await serverSource(file)

    expect(source).not.toMatch(/shortId/)
    expect(source).not.toMatch(/short_id/)
    expect(source).not.toMatch(/practitionerId:\s*z\./)
    expect(source).not.toMatch(/email:\s*z\./)
  })
})

// Checkout is where a Practitioner's MiCare account comes into existence, and
// the profile editor it hands over to is behind the session. So checkout is
// the second place — alongside the magic-link callback — that mints one.
describe('checkout.ts', () => {
  it('mints the session for the account checkout just created', async () => {
    const source = await serverSource('checkout.ts')

    expect(source).toContain('setSession(')
  })

  it('takes that identity from the row, not from the payload it was posted', async () => {
    const source = await serverSource('checkout.ts')

    expect(source).toContain('findPractitionerByEmail(')
  })
})
