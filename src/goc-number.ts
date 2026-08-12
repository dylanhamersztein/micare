// What a GOC registration number looks like, in one place. Shared by the
// public /signup form (src/signup-input.ts) and the operator's manual
// re-verification payload (src/manual-verify-input.ts) — both hand the value
// to the same register lookup, so both have to agree on the shape.
//
// The prefix is either two digits (e.g. 01-123456 for optometrists) OR a one-
// or two-letter code (e.g. D-17909 for dispensing opticians, C-12345 for
// contact-lens specialists, S-12345 for students). The trailing digit run is
// observed to vary between four and six digits across registers, so the
// pattern is permissive on length and uppercase-normalised before matching.

import { z } from 'zod'

const GOC_NUMBER_PATTERN = /^(?:\d{2}|[A-Z]{1,2})-\d{4,6}$/

export const gocNumberSchema = z
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
  )
