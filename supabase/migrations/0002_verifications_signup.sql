-- 0002_verifications_signup.sql
-- Slice 6 (issue #5): the verification module records an attempt for every
-- signup, before any practitioners row exists. Make practitioner_id nullable
-- and add goc_number so the append-only verifications table doubles as the
-- 24h re-scrape suppression cache, keyed by GOC number.
--
-- The weekly re-verification cron (a later slice) still writes rows WITH a
-- practitioner_id; signup-time rows leave it null. Both coexist.

alter table public.verifications
  alter column practitioner_id drop not null;

-- The GOC registration number the attempt was for. Null on legacy/cron rows
-- that are keyed by practitioner_id; always set on signup-time rows.
alter table public.verifications
  add column goc_number text;

-- The full serialized VerificationResult (kind plus payload). Lets a cache
-- hit reconstruct the exact result without re-deriving it from the snapshot.
alter table public.verifications
  add column result jsonb;

-- Drives the 24h suppression-cache lookup: newest verification for a GOC
-- number.
create index verifications_goc_number_scraped_at_idx
  on public.verifications (goc_number, scraped_at desc);
