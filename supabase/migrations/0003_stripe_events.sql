-- 0003_stripe_events.sql
-- Slice 7 (issue #8): per-event idempotency ledger for the Stripe webhook
-- handler. The handler inserts the Stripe event id here as its first action
-- and SKIPS the side effect on a conflict, so replays of the same Stripe
-- event are no-ops. Append-only — no updates, no deletes.

create table public.stripe_events (
  event_id    text primary key,
  event_type  text not null,
  received_at timestamptz not null default now()
);

-- The handler does INSERT ... ON CONFLICT DO NOTHING RETURNING event_id.
-- The primary-key index above is the only one needed.
