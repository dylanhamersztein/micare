-- 0005_revocation_refunds.sql
-- Slice 12 (issue #17): idempotency ledger for the refund-on-revocation
-- handler. The handler inserts the practitioner_id here as its first write and
-- SKIPS the Stripe cancel + email on a conflict, so a replayed revocation is a
-- no-op (no double-cancellation, no duplicate email). Mirrors
-- public.stripe_events (slice 7). Append-only — no updates, no deletes.
--
-- ON DELETE CASCADE: test suites and any future GDPR erasure delete the
-- practitioner row; the ledger entry should follow it.

create table public.revocation_refunds (
  practitioner_id uuid primary key
    references public.practitioners(id) on delete cascade,
  outcome         text not null
    check (outcome in ('refunded', 'already-terminal')),
  handled_at      timestamptz not null default now()
);
