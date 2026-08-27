-- 0010_revocation_refund_amounts.sql
-- Issue #69 / ADR-0029: revocation now issues a real card refund for the
-- unused portion of the billing period, so the ledger records how much money
-- moved and whether it moved at all.
--
-- `outcome` gains two values. 'pending' is what the record-first write
-- (ADR-0008) inserts before any Stripe call: the row still claims the
-- practitioner_id, so a replay is still a no-op, but it no longer asserts an
-- outcome the handler has not reached yet. A row left 'pending' is exactly the
-- stuck case ADR-0008 asks an operator to recover by hand — now findable with
-- a query rather than only in the logs. 'nothing-to-refund' is a subscription
-- that was cancelled with no refundable remainder (no paid invoice, or the
-- paid period already elapsed).
--
-- refunded_pence is the amount actually put back on the card, and is set only
-- on the 'refunded' outcome — the constraint keeps the column from being read
-- as "we refunded nothing" when it means "we have not refunded yet".

alter table public.revocation_refunds
  add column refunded_pence integer;

alter table public.revocation_refunds
  drop constraint revocation_refunds_outcome_check;

alter table public.revocation_refunds
  add constraint revocation_refunds_outcome_check
    check (outcome in ('pending', 'refunded', 'nothing-to-refund',
                       'already-terminal'));

alter table public.revocation_refunds
  add constraint revocation_refunds_refunded_pence_check
    check ((outcome = 'refunded') = (refunded_pence is not null)
           and (refunded_pence is null or refunded_pence > 0));
