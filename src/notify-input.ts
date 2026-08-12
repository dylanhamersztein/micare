// The public Notify-Me form payload. Pure Zod — shared by the search
// empty-state form (client-side validation before submit) and
// src/server/notify.ts (the authoritative server-side check), exactly as
// src/signup-input.ts is.
//
// Both fields are normalised here rather than at the database, because the
// composite uniqueness on (email, postcode) is what makes a re-submit
// idempotent: "Jane@Example.co.uk / ec2v6aa" and "jane@example.co.uk /
// EC2V 6AA" have to collide on the same row.

import { z } from 'zod'

import { formatUkPostcode, isFullUkPostcode } from './uk-postcode'

export const notifyInputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.string().email('Enter a valid email address')),
  postcode: z
    .string()
    .trim()
    .refine(isFullUkPostcode, {
      message: 'Enter a full UK postcode, e.g. EC2V 6AA',
    })
    .transform(formatUkPostcode),
})

export type NotifyInput = z.infer<typeof notifyInputSchema>
