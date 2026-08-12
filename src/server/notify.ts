// Thin createServerFn wrappers around the Notify-Me module. The search page
// and the /notify-me/* routes import these; integration tests import from
// ./notify-impl directly so they exercise the real code path without bouncing
// through TanStack's RPC layer (matching src/server/click-tracking.ts).
//
// The input is re-validated here with the same schema the form uses, because
// the form's copy of it is a convenience for the consumer, not a guarantee.

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { notifyInputSchema } from '../notify-input'
import {
  confirmNotifySubscription,
  subscribeToNotifications,
  unsubscribeFromNotifications,
} from './notify-impl'

const tokenSchema = z.object({ token: z.string().trim().min(1) })

export const subscribeToNotifyMe = createServerFn({ method: 'POST' })
  .inputValidator((raw: unknown) => notifyInputSchema.parse(raw))
  .handler(({ data }) => subscribeToNotifications(data))

export const confirmNotifyMe = createServerFn({ method: 'GET' })
  .inputValidator((raw: unknown) => tokenSchema.parse(raw))
  .handler(({ data }) => confirmNotifySubscription(data.token))

export const unsubscribeFromNotifyMe = createServerFn({ method: 'GET' })
  .inputValidator((raw: unknown) => tokenSchema.parse(raw))
  .handler(({ data }) => unsubscribeFromNotifications(data.token))
