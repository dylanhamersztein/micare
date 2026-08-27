-- 0009_drop_practitioners_visible.sql
-- Issue #65 / ADR-0024: visibility is computed, never stored.
--
-- The `visible` boolean was a Slice 1 simplification (see the comment at the
-- top of 0001_core_tables.sql) that outlived the state machines it stood in
-- for. Every consumer surface already recomputes visibility from
-- verification_status, subscription_status and the minimum profile fields;
-- only the two maintenance crons still read the stored flag, and no writer
-- maintained it across a Stripe webhook or a manual re-verification. A
-- Practitioner activated by the webhook was therefore listed to consumers
-- while the weekly re-verification and the daily stale alert both skipped
-- them — ADR-0002's invariant broken by a column nobody could keep true.
--
-- Dropping the column removes the drift, not the rule: the rule lives in
-- src/visibility.ts.

drop index if exists public.practitioners_visible_idx;

alter table public.practitioners
  drop column if exists visible;
