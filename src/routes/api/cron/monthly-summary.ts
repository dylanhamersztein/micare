import { createFileRoute } from '@tanstack/react-router'

import { handleMonthlySummaryCron } from '../../../server/monthly-summary-cron'

export const Route = createFileRoute('/api/cron/monthly-summary')({
  server: {
    handlers: {
      GET: ({ request }) => handleMonthlySummaryCron(request),
    },
  },
})
