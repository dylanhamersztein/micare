import { createFileRoute } from '@tanstack/react-router'

import { handleReVerifyCron } from '../../../server/reverify-cron'

export const Route = createFileRoute('/api/cron/re-verify')({
  server: {
    handlers: {
      GET: ({ request }) => handleReVerifyCron(request),
    },
  },
})
