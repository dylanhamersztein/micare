// The operator's manual re-verification payload (issue #10). Pure Zod, in
// the same idiom as src/signup-input.ts — the admin route parses an untrusted
// JSON body with it before touching the database.

import { z } from 'zod'

import { gocNumberSchema } from './goc-number'

export const manualVerifyInputSchema = z.object({
  gocNumber: gocNumberSchema,
  // Bypasses the verification module's 24h re-scrape suppression cache. Off
  // unless asked for: the cache exists to keep MiCare off the GOC register's
  // back, and a stuck-pending Practitioner is usually stuck because of a
  // timeout, not because of a stale cached answer.
  force: z.boolean().default(false),
})

export type ManualVerifyInput = z.infer<typeof manualVerifyInputSchema>
