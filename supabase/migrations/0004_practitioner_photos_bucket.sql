-- 0004_practitioner_photos_bucket.sql
-- Phase 1 slice 9: provision the practitioner-photos Storage bucket.
--
-- This migration touches the storage.* tables that exist only on hosted
-- Supabase (the local Compose stack runs vanilla Postgres + PostGIS,
-- without the storage schema). The do-block swallows the
-- undefined_table error so `pnpm db:migrate` against Compose remains a
-- no-op for this slice.

do $$
begin
  insert into storage.buckets (id, name, public)
  values ('practitioner-photos', 'practitioner-photos', true)
  on conflict (id) do nothing;

  -- Anyone may read; only the service role may write. Practitioner-scoped
  -- write authz lives in the server function (we trust the short_id on
  -- the orchestrator's input), so the bucket policy is intentionally
  -- service-role-only.
  create policy "public read practitioner-photos"
    on storage.objects for select
    using (bucket_id = 'practitioner-photos');
exception
  when undefined_table then null;
  when duplicate_object then null;
end $$;
