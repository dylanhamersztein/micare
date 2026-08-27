// `verification` deep module (pure half). The result types and the coarse
// outcome mapping. No IO, no env, no heavy dependencies — the /signup route
// imports these types and PROFESSION_CODES directly, so nothing here may pull
// server code or an HTML parser into the browser bundle. The DB-backed
// `verify` lives in src/server/verification-impl.ts; the HTML parser lives in
// src/goc-register.ts; the mock fixtures are added to this file in Task 4.

// The regulated Professions MiCare can verify. Phase 1 is opticians (GOC)
// only; the enum is first-class so HCPC/GDC professions are a later addition,
// not a re-architecture (CONTEXT.md, PRD "Out of Scope").
export const PROFESSION_CODES = ['optician'] as const
export type ProfessionCode = (typeof PROFESSION_CODES)[number]

// The outcome of one verification attempt against a regulator's register.
//   found-active — exactly one register entry matches the number and is in a
//                  registered/active state.
//   name-mismatch — the number is on the register and active, but the entry
//                  belongs to somebody else: the submitted name is not the
//                  registrant's (issue #68). Rejected, not pending — the
//                  register answered clearly, we just cannot hand this
//                  registration to this person.
//   not-found    — the register loaded, but no active entry matches.
//   ambiguous    — the register loaded but could not be read confidently
//                  (unexpected layout, or multiple conflicting matches).
//   error        — the register could not be reached (timeout / HTTP error).
export type VerificationResult =
  | { kind: 'found-active'; registrationNumber: string; registrantName: string }
  | {
      kind: 'name-mismatch'
      registrationNumber: string
      registrantName: string
    }
  | { kind: 'not-found'; registrationNumber: string }
  | { kind: 'ambiguous'; registrationNumber: string }
  | { kind: 'error'; registrationNumber: string; reason: string }

// The coarse status a result collapses to. Doubles as the `verifications`
// table's `status` value and the /signup UI end-state — in Phase 1 the two
// are the same three values.
export type VerificationOutcome = 'verified' | 'rejected' | 'pending'

// Collapses a VerificationResult to its coarse outcome. ADR-0002: `pending`
// is the manual-review fallback for the cases MiCare cannot auto-decide
// (ambiguous register page, or a technical failure) — never consumer-visible.
export function verificationOutcome(
  result: VerificationResult,
): VerificationOutcome {
  switch (result.kind) {
    case 'found-active':
      return 'verified'
    case 'name-mismatch':
    case 'not-found':
      return 'rejected'
    case 'ambiguous':
    case 'error':
      return 'pending'
  }
}

// Honorifics the register and the prospect disagree about far more often than
// they disagree about the name underneath. Dropped from both sides before the
// comparison so "Dr Jane Smith" and "Jane Smith" are one person.
const HONORIFICS = new Set([
  'dr',
  'prof',
  'professor',
  'mr',
  'mrs',
  'ms',
  'miss',
  'mx',
])

// Reduces a name to the tokens the comparison runs on: diacritics folded,
// case flattened, honorifics removed. Apostrophes and hyphens close up rather
// than split, because they join a name rather than separate two — O'Brien and
// OBrien are one token, and so are the two halves of a double-barrelled
// surname. Everything else that is not a letter or a digit is a separator.
function nameTokens(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['\u2019-]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((token) => token !== '' && !HONORIFICS.has(token))
}

// Matches on the first and last token only. A register entry and a signup
// form disagree about middle names constantly — the GOC holds what was on the
// certificate, the prospect types what they go by — and rejecting a genuine
// registrant over an absent middle name would be a worse failure than the one
// this check exists to prevent. First and last name are what the register
// publishes as the person's identity, so they are what we hold them to.
function namesMatch(registrantName: string, submittedName: string): boolean {
  const registrant = nameTokens(registrantName)
  const submitted = nameTokens(submittedName)

  if (registrant.length === 0 || submitted.length === 0) return false

  return (
    registrant[0] === submitted[0] &&
    registrant[registrant.length - 1] === submitted[submitted.length - 1]
  )
}

// The adjudication half of Verification (issue #68). The register answers a
// number; this decides whether that answer belongs to the person asking.
//
// Total in both directions on purpose: the 24h suppression cache is keyed on
// the GOC number alone, so the row one prospect's mistyped name wrote is the
// row the real registrant's attempt reads back. Re-adjudicating a cached
// `name-mismatch` is what stops the cache becoming a 24h lockout on somebody
// else's registration.
export function applyNameMatch(
  result: VerificationResult,
  submittedName: string,
): VerificationResult {
  if (result.kind !== 'found-active' && result.kind !== 'name-mismatch') {
    return result
  }

  const matched = namesMatch(result.registrantName, submittedName)
  return {
    kind: matched ? 'found-active' : 'name-mismatch',
    registrationNumber: result.registrationNumber,
    registrantName: result.registrantName,
  }
}

// Deterministic fixtures for GOC_MOCK=true. Keyed by GOC number so tests and
// local dev can drive any outcome by choosing a number. The 99-0000NN numbers
// are reserved for the e2e and integration suites. 99-000001 is deliberately
// absent: it is the verified fixture, and the default below is what makes it
// verify (issue #68).
const GOC_MOCK_FIXTURES: Record<string, VerificationResult> = {
  '99-000002': { kind: 'not-found', registrationNumber: '99-000002' },
  '99-000003': { kind: 'ambiguous', registrationNumber: '99-000003' },
  '99-000004': {
    kind: 'error',
    registrationNumber: '99-000004',
    reason: 'mock error fixture',
  },
  // The registrant who is somebody in particular, so the name-mismatch path
  // is reachable under GOC_MOCK. Named for the saved GOC fixture page.
  '99-000005': {
    kind: 'found-active',
    registrationNumber: '99-000005',
    registrantName: 'Ethan Belson',
  },
}

// The GOC_MOCK=true verification path: a deterministic result, no network
// call. An unrecognised number defaults to found-active under the name it was
// asked about, so a developer signing up locally with an arbitrary number is
// the registrant and lands on the verified flow. A mock register that held
// one fixed name would fail the name check for everybody.
export function mockVerify(
  regNumber: string,
  fullName: string,
): VerificationResult {
  return (
    GOC_MOCK_FIXTURES[regNumber] ?? {
      kind: 'found-active',
      registrationNumber: regNumber,
      registrantName: fullName,
    }
  )
}
