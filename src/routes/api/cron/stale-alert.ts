import { createFileRoute } from '@tanstack/react-router'

import { handleStaleAlertCron } from '../../../server/stale-alert-cron'

export const Route = createFileRoute('/api/cron/stale-alert')({
  server: {
    handlers: {
      GET: ({ request }) => handleStaleAlertCron(request),
    },
  },
})
