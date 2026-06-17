// Generates a Customer Portal link for the authenticated Practitioner on
// demand (portal URLs are single-use, so this is not embedded in the page).

import { createServerFn } from '@tanstack/react-start'

import { createBillingPortalUrlImpl } from './billing-portal-impl'
import { readSession } from './session'

export type OpenBillingPortalResult =
  | { kind: 'unauthenticated' }
  | { kind: 'ok'; url: string }

export const openBillingPortal = createServerFn({ method: 'POST' }).handler(
  async (): Promise<OpenBillingPortalResult> => {
    const session = await readSession()
    if (!session) return { kind: 'unauthenticated' }

    const result = await createBillingPortalUrlImpl(session.email)
    if (!result) return { kind: 'unauthenticated' }

    return { kind: 'ok', url: result.url }
  },
)
