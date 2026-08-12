// Thin createServerFn wrapper around recordAndRedirect. The /go route loader
// imports this; integration tests import recordAndRedirect from
// ./click-tracking-impl directly so they exercise the real code path without
// bouncing through TanStack's RPC layer.
//
// getRequest() supplies the inbound request the visitor hash is derived from —
// on a full page load that is the consumer's own request to /go, and on a
// client-side navigation it is their RPC fetch, so the IP and user agent are
// the consumer's either way.

import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'

import { recordAndRedirect } from './click-tracking-impl'

const inputSchema = z.object({ shortId: z.string().trim().min(1) })

export const followBookingLink = createServerFn({ method: 'GET' })
  .inputValidator((raw: unknown) => inputSchema.parse(raw))
  .handler(({ data }) => recordAndRedirect(data.shortId, getRequest()))
