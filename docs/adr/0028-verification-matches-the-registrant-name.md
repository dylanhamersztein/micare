# Verification matches the registrant name, on first and last name only

`verify(profession, fullName, regNumber)` took the submitted name and never
compared it to anything. The decision was made on the GOC number alone: the
number resolves to a card, the card reads as registered, done. The registrant
name was parsed out of the detail-page heading and read by nobody (issue #68).

That is a hole with a public register on the other side of it. The GOC register
is searchable — that is the whole reason MiCare can scrape it — so a GOC number
is not a secret and proves nothing about who is typing it. Anyone could list
under any name using a number lifted from the register, on a product whose
entire brand is verification. It also put `/signup` in breach of ADR-0019:
the rejection copy named "your name differs from the one the register holds" as
a reason the check may have failed, which was a claim about a check that did not
exist.

**The name check is adjudication, separate from the scrape.** The parser stays
what it was — a pure reading of what the register says. `applyNameMatch` in
`src/verification.ts` takes that reading plus the name the prospect submitted
and decides whether the answer belongs to the person asking, downgrading a
`found-active` to the new `name-mismatch` kind. Keeping the two apart is what
lets the check run on a cached answer as well as a fresh one.

**`name-mismatch` is `rejected`, not `pending`.** The register answered, and it
answered clearly; there is nothing for an operator to resolve. It is a distinct
kind rather than a re-used `not-found` because the two mean different things to
the weekly sweep — see below — and because `not-found` would throw away the
registrant name the next caller needs.

**The 24h suppression cache is re-adjudicated, in both directions.** The cache
is keyed on the GOC number alone (ADR-0026), so without this the check would be
trivially bypassable: let the real registrant verify, then submit the same
number under any name within 24 hours and read their answer back. The mirror
failure matters just as much — the row one prospect's mistyped name wrote is the
row the real registrant's attempt reads back, and a cache that could only reject
would be a 24h lockout on somebody else's registration. So `applyNameMatch` is
total over both `found-active` and `name-mismatch`, and `verify` runs it on the
cached result before returning it. Nothing about the scrape volume changes: a
cache hit is still a cache hit.

**Matching is on first and last name.** Middle names, honorifics, case,
accents, apostrophes and hyphens are all normalised away, and only the first and
last remaining tokens are compared. A register entry and a signup form disagree
about middle names constantly — the GOC holds what was on the certificate, the
prospect types what they go by — and rejecting a genuine registrant over an
absent middle name is a worse failure than the one this check exists to prevent.
First and last name are what the register publishes as the person's identity, so
they are what we hold a prospect to. The signup copy now states that rule
verbatim, and `tests/unit/components/signup-outcome.test.tsx` fails if the copy
and the rule drift apart.

**A card with no readable name is `ambiguous`, not a nameless pass.** Now that
the heading feeds a decision, a heading the parser cannot read is a decision it
cannot make. Returning `found-active` with an empty registrant name would fail
every name match and reject genuine registrants the day the GOC changes its
markup; escalating sends it to a human instead (ADR-0025 files the prospect as
`pending`).

**The weekly sweep does not revoke on a name mismatch.** The number is still on
the register and still active; what has usually moved is the name. Revocation
cancels a subscription and issues a refund (ADR-0008), which is far too much to
do to a genuine registrant over a marriage certificate. `name-mismatch` joins
`error` and `ambiguous` in the sweep's indeterminate branch: the row is left
exactly as found, `last_verified_at` is not bumped, and it ages into the daily
stale alert for a person to look at (ADR-0007).

**The mock register holds a name.** Under `GOC_MOCK`, an unreserved number now
answers with whatever name it was asked about — a developer signing up locally
is the registrant — because a mock holding one fixed name would fail the check
for everybody. `99-000005` is reserved as the number that belongs to somebody in
particular, so the mismatch path stays reachable from the integration and E2E
suites.
