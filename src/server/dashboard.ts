// Reads the session, then loads the dashboard read model for the
// authenticated Practitioner. Returns a discriminated result so the route
// loader can redirect unauthenticated visitors to the magic-link flow.

import { createServerFn } from '@tanstack/react-start'

import { loadDashboardImpl } from './dashboard-impl'
import type { DashboardData } from './dashboard-impl'
import { readSession } from './session'

export type DashboardResult =
  | { kind: 'unauthenticated' }
  | { kind: 'ok'; data: DashboardData }

export const loadDashboard = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DashboardResult> => {
    const session = await readSession()
    if (!session) return { kind: 'unauthenticated' }

    const data = await loadDashboardImpl(session.email)
    // A session whose Practitioner row vanished is treated as logged out.
    if (!data) return { kind: 'unauthenticated' }

    return { kind: 'ok', data }
  },
)
