// The public /signup form payload. Pure Zod — shared by the route component
// (client-side validation before submit) and src/server/signup.ts (the
// authoritative server-side check), exactly as src/search-input.ts is shared.

import { z } from 'zod'

import { PROFESSION_CODES } from './verification'

// GOC registration numbers are formatted <prefix>-<digits>. The prefix is
// either two digits (e.g. 01-123456 for optometrists) OR a one- or two-letter
// code (e.g. D-17909 for dispensing opticians, C-12345 for contact-lens
// specialists, S-12345 for students). The trailing digit run is observed to
// vary between four and six digits across registers, so the pattern is
// permissive on length and uppercase-normalised before matching.
const GOC_NUMBER_PATTERN = /^(?:\d{2}|[A-Z]{1,2})-\d{4,6}$/

export const signupInputSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter your full name').max(120),
  professionCode: z.enum(PROFESSION_CODES),
  gocNumber: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(
      z
        .string()
        .regex(
          GOC_NUMBER_PATTERN,
          'GOC number should look like 01-123456 or D-17909',
        ),
    ),
  email: z.string().trim().email('Enter a valid email address'),
})

export type SignupInput = z.infer<typeof signupInputSchema>
