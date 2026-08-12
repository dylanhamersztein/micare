// Operator-facing manual re-verification (issue #10). `pending` means the
// signup-time scrape never came back — rare, and invisible to everyone but
// the Practitioner, who is left with an account that does nothing. This is
// the one-shot path back: re-run the verification deep module for one GOC
// number and apply whatever it says.

import { env } from '../env.server'
import { manualVerifyInputSchema } from '../manual-verify-input'
import type { ManualVerifyInput } from '../manual-verify-input'
import { verificationOutcome } from '../verification'
import type {
  ProfessionCode,
  VerificationOutcome,
  VerificationResult,
} from '../verification'
import type { VerificationStatus } from '../visibility'
import { bearerAuthError } from './cron-auth'
import { db } from './db'
import { verify } from './verification-impl'

export type ManualVerificationOutcome =
  | { kind: 'no-such-practitioner'; gocNumber: string }
  | {
      kind: 'not-pending'
      gocNumber: string
      practitionerId: string
      verificationStatus: VerificationStatus
    }
  | {
      kind: 'applied'
      gocNumber: string
      practitionerId: string
      previousStatus: VerificationStatus
      result: VerificationResult['kind']
      newStatus: VerificationOutcome
      forced: boolean
    }

type PractitionerRow = {
  id: string
  full_name: string
  profession_code: string
  verification_status: VerificationStatus
}

export async function runManualVerification(
  input: ManualVerifyInput,
): Promise<ManualVerificationOutcome> {
  const { rows } = await db.query<PractitionerRow>(
    `select id, full_name, profession_code, verification_status
       from public.practitioners
      where goc_number = $1`,
    [input.gocNumber],
  )
  const practitioner = rows.at(0)
  if (!practitioner) {
    return { kind: 'no-such-practitioner', gocNumber: input.gocNumber }
  }

  // Only `pending` is recoverable here. `verified` needs no help, `rejected`
  // never got an account, and `revoked` is a decision the weekly cron made on
  // evidence — reinstating one is a deliberate act, not a retry.
  if (practitioner.verification_status !== 'pending') {
    return {
      kind: 'not-pending',
      gocNumber: input.gocNumber,
      practitionerId: practitioner.id,
      verificationStatus: practitioner.verification_status,
    }
  }

  const result = await verify(
    practitioner.profession_code as ProfessionCode,
    practitioner.full_name,
    input.gocNumber,
    { force: input.force },
  )

  // `pending` means the register could not be read — ambiguous layout or a
  // technical failure. That is not evidence about the Practitioner, so the
  // row keeps its (absent) last_verified_at and the operator retries later.
  const newStatus = verificationOutcome(result)
  if (newStatus !== 'pending') {
    await db.query(
      `update public.practitioners
          set verification_status = $2,
              last_verified_at = now(),
              updated_at = now()
        where id = $1`,
      [practitioner.id, newStatus],
    )
  }

  return {
    kind: 'applied',
    gocNumber: input.gocNumber,
    practitionerId: practitioner.id,
    previousStatus: practitioner.verification_status,
    result: result.kind,
    newStatus,
    forced: input.force,
  }
}

const HTTP_STATUS: Record<ManualVerificationOutcome['kind'], number> = {
  applied: 200,
  'no-such-practitioner': 404,
  // Not an error the operator can fix by retrying — the Practitioner is in a
  // state this tool deliberately will not touch.
  'not-pending': 409,
}

export async function handleManualVerifyRequest(
  request: Request,
): Promise<Response> {
  const authError = bearerAuthError(
    request,
    env.OPERATOR_SECRET,
    'OPERATOR_SECRET',
  )
  if (authError) return authError

  // The operator is typing this by hand into curl, so a bad body should read
  // like an answer, not a stack trace.
  const parsed = manualVerifyInputSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((issue) => issue.message).join('; ') },
      { status: 400 },
    )
  }

  const outcome = await runManualVerification(parsed.data)
  // The audit trail: one structured line per re-run, in the Vercel logs
  // beside the cron summaries. Refusals are logged too — "the operator tried
  // and was told no" is as much a part of the trail as a state change.
  console.log('[admin:verify-practitioner]', JSON.stringify(outcome))
  return Response.json(outcome, { status: HTTP_STATUS[outcome.kind] })
}
