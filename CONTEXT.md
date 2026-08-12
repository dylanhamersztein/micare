# MiCare

UK marketplace connecting consumers with verified independent healthcare practitioners. Phase 1 is opticians-only; the schema treats profession as a first-class field so additional regulated professions can be added without restructuring.

## Language

**Practitioner**:
A regulated healthcare professional listed on MiCare. The unit of listing, verification, and subscription.
_Avoid_: provider, professional, optician (too narrow — couples vocabulary to Phase 1), trader (Checkatrade language, wrong domain).

**Profession**:
The regulated discipline a Practitioner belongs to (e.g. Optician, Physiotherapist, Dental Hygienist). Determines which regulator and register apply for verification.
_Avoid_: vertical, category, specialty.

**Practice**:
The physical location where a Practitioner operates — a real address with a UK postcode that consumers can search against. In Phase 1, every Practitioner has exactly one Practice; mobile and home-visiting Practitioners are out of scope until Phase 2. Practice is an attribute of a Practitioner, not a first-class entity.
_Avoid_: clinic, shop, business, surgery.

**Verification**:
The act of confirming a Practitioner is currently registered with their Profession's regulator (e.g. GOC for Optician). Performed synchronously at signup and re-checked on a recurring cadence.
_Avoid_: validation, accreditation, certification.

**Verification Status**:
A Practitioner's current standing with their regulator, as known to MiCare. One of:

- `pending` — signup scrape timed out; not yet confirmed. Rare. Not visible to consumers.
- `verified` — confirmed present and active on the regulator's register. The only consumer-visible status.
- `rejected` — signup scrape ran and the Practitioner was not on the register. Signup blocked, no charge.
- `revoked` — was previously `verified`, but a re-check found them no longer on the register (e.g. struck off). Hidden from consumers; row preserved for refund and audit.

_Avoid_: state, badge, level.

**Subscription Status**:
A Practitioner's current standing with Stripe, as known to MiCare. Mirrored verbatim from Stripe's subscription status — Stripe is the system of record, MiCare only projects it onto visibility (ADR-0010). One of:

- `incomplete` — signed up, Checkout not completed. Not visible.
- `active` — paying. Visible.
- `trialing` — inside a trial period. Visible.
- `past_due` — a renewal payment failed and Stripe is retrying. **Still visible** for the duration of Stripe's dunning window (ADR-0004) — a failed card is usually a card problem, not a Practitioner leaving.
- `unpaid` — dunning ran out. Hidden, row and all profile fields preserved.
- `canceled` — the subscription ended. Hidden, row and all profile fields preserved, so resubscribing restores the same listing.

A cancellation scheduled at period end holds `active` until the period actually ends, because Stripe holds it there.
_Avoid_: plan, membership, billing state.

**Billing Cycle**:
The month a **Practitioner**'s £29 subscription currently covers, as a half-open window `[start, end)` — `end` is the renewal instant and belongs to the next cycle. Stripe owns the bounds (they live on the subscription's item, not the subscription); MiCare reads them rather than recomputing, so a moved anchor or a pause can't drift the window (ADR-0011). The unit both the dashboard **Click-through** count and the monthly summary email report against.
_Avoid_: billing period, month, subscription period.

**Booking Link**:
The external URL a Practitioner provides where consumers complete a booking — typically their own site, an online booking system, or a calendar provider page. The sole conversion action on a Practitioner profile in Phase 1. Consumers reach it via a MiCare-controlled redirect so click-throughs can be counted.
_Avoid_: contact link, schedule URL, booking page.

**Click-through**:
One consumer following a **Practitioner**'s **Booking Link** via the MiCare redirect at `/go?p=<short_id>`. Recorded once per visitor per **Practitioner** per 24 hours, against a salted hash of IP + user agent — so the count means distinct interested consumers, not page loads (ADR-0009). The only conversion signal MiCare holds; the dashboard and the monthly summary email both report it per billing cycle.
_Avoid_: click, hit, view, visit, lead.

## Relationships

- A **Practitioner** has exactly one **Profession**.
- A **Practitioner** has exactly one **Practice** in Phase 1 (expected to relax in Phase 2 to support mobile Practitioners and multi-Practitioner Practices such as Dental Hygienists working in dental surgeries).
- A **Practitioner** has exactly one **Verification Status**.
- A **Practitioner** has exactly one **Subscription Status**.
- Only **Practitioners** with `Verification Status = verified` and a **Subscription Status** of `active`, `trialing`, or `past_due` are visible to consumers.

## Maintenance jobs

Three scheduled jobs run as Vercel Cron routes under `/api/cron/`, each guarded by a `CRON_SECRET` bearer token. The first two keep verification fresh after signup (ADR-0007).

- **Weekly re-verification** (`0 3 * * 1`): re-runs `verify` against every visible **Practitioner**. A still-active result bumps `last_verified_at`; a definitive not-found flips **Verification Status** to `revoked` and hides the profile; a transient scraper error leaves the row untouched (it ages into the stale alert instead).
- **Daily stale alert** (`0 8 * * *`): emails the operator (`OPERATOR_ALERT_EMAIL`) and logs when visible **Practitioners** have gone un-reverified past `STALE_VERIFICATION_DAYS` (default 14) — an early signal that the weekly job or the GOC scraper is failing.
- **Daily monthly summary** (`0 9 * * *`): emails each **Practitioner** whose **Billing Cycle** ends tomorrow their **Click-through** count for that cycle (ADR-0011).

## Example dialogue

> **Dev:** "When a **Practitioner** signs up, do we need a **Practice** address?"
> **Domain expert:** "Yes — in Phase 1 every Practitioner is shop-based. Mobile and home-visiting Practitioners come later."
> **Dev:** "And the GOC entry we verify against — that belongs to the **Practitioner**, not the **Practice**?"
> **Domain expert:** "Right. The regulator only registers people."

## Flagged ambiguities

_(none yet)_
