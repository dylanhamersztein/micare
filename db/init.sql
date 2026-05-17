CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS auth;

-- Match Supabase hosted convention: PostgREST and migrations resolve
-- types like `geography` and functions like `ST_DWithin` without
-- schema-qualifying them.
ALTER DATABASE postgres SET search_path = public, extensions;
