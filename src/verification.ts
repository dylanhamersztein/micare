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
//   not-found    — the register loaded, but no active entry matches.
//   ambiguous    — the register loaded but could not be read confidently
//                  (unexpected layout, or multiple conflicting matches).
//   error        — the register could not be reached (timeout / HTTP error).
export type VerificationResult =
  | { kind: 'found-active'; registrationNumber: string; registrantName: string }
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
    case 'not-found':
      return 'rejected'
    case 'ambiguous':
    case 'error':
      return 'pending'
  }
}

// Deterministic fixtures for GOC_MOCK=true. Keyed by GOC number so tests and
// local dev can drive any outcome by choosing a number. The 99-0000NN numbers
// are reserved for the e2e and integration suites.
const GOC_MOCK_FIXTURES: Record<string, VerificationResult> = {
  '99-000001': {
    kind: 'found-active',
    registrationNumber: '99-000001',
    registrantName: 'Mock Verified Optician',
  },
  '99-000002': { kind: 'not-found', registrationNumber: '99-000002' },
  '99-000003': { kind: 'ambiguous', registrationNumber: '99-000003' },
  '99-000004': {
    kind: 'error',
    registrationNumber: '99-000004',
    reason: 'mock error fixture',
  },
}

// The GOC_MOCK=true verification path: a deterministic result, no network
// call. An unrecognised number defaults to found-active so a developer
// signing up locally with an arbitrary number lands on the verified flow.
export function mockVerify(regNumber: string): VerificationResult {
  return (
    GOC_MOCK_FIXTURES[regNumber] ?? {
      kind: 'found-active',
      registrationNumber: regNumber,
      registrantName: 'Mock Optician',
    }
  )
}
