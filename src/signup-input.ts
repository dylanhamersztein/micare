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
