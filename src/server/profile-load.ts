// Thin createServerFn wrapper around loadEditableProfile. The route loader
// imports this; integration tests import loadEditableProfile from
// ./profile-load-impl directly so they exercise the real code path without
// bouncing through TanStack's RPC layer.
//
// The Practitioner comes from the sealed session (ADR-0006), so this takes no
// input at all — mirroring ./dashboard.ts and ./billing-portal.ts.

import { createServerFn } from '@tanstack/react-start'

import { loadEditableProfile } from './profile-load-impl'
import type { EditableProfile } from './profile-load-impl'
import { readSession } from './session'

export type ProfileLoadResult =
  | { kind: 'unauthenticated' }
  | { kind: 'ok'; profile: EditableProfile }

export const loadProfile = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ProfileLoadResult> => {
    const session = await readSession()
    if (!session) return { kind: 'unauthenticated' }

    const profile = await loadEditableProfile(session.email)
    // A session whose Practitioner row vanished is treated as logged out.
    if (!profile) return { kind: 'unauthenticated' }

    return { kind: 'ok', profile }
  },
)
