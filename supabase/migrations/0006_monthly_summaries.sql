-- 0006_monthly_summaries.sql
-- Slice 14 (issue #15): idempotency ledger for the monthly summary email. The
-- job inserts (practitioner_id, period_end) as its first write and SKIPS the
-- Resend send on a conflict, so re-running it for the same billing cycle sends
-- nothing. Keyed on period_end rather than a date, so the next cycle's renewal
-- is a distinct key and next month's summary still goes out. Mirrors
-- public.revocation_refunds (slice 12). Append-only — no updates, no deletes.
--
-- clickthrough_count records what the Practitioner was actually told, so an
-- operator can answer "what did that email say?" without recomputing it.
--
-- ON DELETE CASCADE: test suites and any future GDPR erasure delete the
-- practitioner row; the ledger entry should follow it.

create table public.monthly_summaries (
  practitioner_id    uuid not null
    references public.practitioners(id) on delete cascade,
  period_end         timestamptz not null,
  clickthrough_count integer not null,
  sent_at            timestamptz not null default now(),
  primary key (practitioner_id, period_end)
);
