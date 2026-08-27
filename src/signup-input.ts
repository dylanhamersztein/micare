// The public /signup form payload. Pure Zod — shared by the route component
// (client-side validation before submit) and src/server/signup.ts (the
// authoritative server-side check), exactly as src/search-input.ts is shared.

import { z } from 'zod'

import { gocNumberSchema } from './goc-number'
import { PROFESSION_CODES } from './verification'

export const signupInputSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter your full name').max(120),
  professionCode: z.enum(PROFESSION_CODES),
  gocNumber: gocNumberSchema,
  email: z.string().trim().email('Enter a valid email address'),
})

export type SignupInput = z.infer<typeof signupInputSchema>

// What the /signup server function is actually posted. The retry flag is not
// part of the prospect — it is what the pending panel's "Try the check again"
// button says about *this* submission — so it rides alongside the details
// rather than inside them, and only signupInputSchema's fields are ever
// written to a Practitioner row.
export const signupRequestSchema = signupInputSchema.extend({
  retry: z.boolean().optional(),
})

export type SignupRequest = z.infer<typeof signupRequestSchema>
