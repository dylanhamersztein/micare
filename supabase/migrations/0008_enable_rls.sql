-- 0008_enable_rls.sql
-- Phase 1 slice 18: encode the deny-all RLS perimeter in migrations.
--
-- Every table in `public` gets row level security enabled and no
-- policies, which leaves it unreachable to `anon` and `authenticated`.
-- MiCare's data path is the service-role `pg` pool in src/server/db.ts,
-- and the service role bypasses RLS, so the application is unaffected —
-- see ADR-0015.
--
-- On the hosted project four of these tables already have RLS enabled
-- out of band, courtesy of Supabase's `public.rls_auto_enable()` event
-- trigger. `enable row level security` is idempotent, so those statements
-- are no-ops there; the point of this migration is that no environment
-- has to depend on that platform trigger.
--
-- Tables added after this migration must enable RLS themselves. The
-- integration test in tests/integration/rls.test.ts fails CI if one
-- doesn't.

alter table public.practitioners         enable row level security;
alter table public.verifications         enable row level security;
alter table public.clickthroughs         enable row level security;
alter table public.notify_subscriptions  enable row level security;
alter table public.stripe_events         enable row level security;
alter table public.revocation_refunds    enable row level security;
alter table public.monthly_summaries     enable row level security;
alter table public.notify_fires          enable row level security;
