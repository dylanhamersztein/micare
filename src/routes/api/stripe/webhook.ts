import { createFileRoute } from '@tanstack/react-router'

import { handleStripeWebhook } from '../../../server/webhook-handler'

export const Route = createFileRoute('/api/stripe/webhook')({
  server: {
    handlers: {
      POST: ({ request }) => handleStripeWebhook(request),
    },
  },
})
