-- 0007_notify_fires.sql
-- Slice 16 (issue #18): idempotency ledger for the Notify-Me fire. The hook
-- inserts the practitioner_id here as its first write and SKIPS the whole
-- send on a conflict, so a Practitioner who is hidden and shown again never
-- re-emails the same subscribers (explicitly out of scope per the PRD).
-- Mirrors public.revocation_refunds (slice 12) and public.monthly_summaries
-- (slice 14). Append-only — no updates, no deletes.
--
-- notified_count records how many confirmed subscribers were in range at the
-- moment of the fire, so an operator can answer "who did we tell?" without
-- recomputing a radius against a register that has since moved.
--
-- ON DELETE CASCADE: test suites and any future GDPR erasure delete the
-- practitioner row; the ledger entry should follow it.

create table public.notify_fires (
  practitioner_id uuid primary key
    references public.practitioners(id) on delete cascade,
  notified_count  integer not null,
  fired_at        timestamptz not null default now()
);
