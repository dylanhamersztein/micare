// The one session read the whole app shares. The header has to know whether it
// is talking to a signed-in Practitioner before it can decide between "Sign in"
// and "Dashboard", and the header is on every page — so the read moves from
// the dashboard's own loader up to the root route (ADR-0021).
//
// Only the answer crosses the wire: the shell needs to know that someone is
// signed in, never who, so the practitionerId and email stay on the server.

import { createServerFn } from '@tanstack/react-start'

import { readSession } from './session'

export type ShellSession = { signedIn: boolean }

export const readShellSession = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ShellSession> => ({
    signedIn: (await readSession()) !== null,
  }),
)
