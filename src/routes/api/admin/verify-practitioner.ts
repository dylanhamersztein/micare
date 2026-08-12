import { createFileRoute } from '@tanstack/react-router'

import { handleManualVerifyRequest } from '../../../server/manual-verify'

export const Route = createFileRoute('/api/admin/verify-practitioner')({
  server: {
    handlers: {
      POST: ({ request }) => handleManualVerifyRequest(request),
    },
  },
})
