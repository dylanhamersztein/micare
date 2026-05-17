#!/usr/bin/env bash
# Reset the local `public` schema and reapply every migration under
# supabase/migrations/ in lexicographic order. Equivalent intent to
# `supabase db reset --local` against the Compose Postgres — we don't
# use `supabase start`, so the Supabase CLI's reset path isn't available.

set -euo pipefail

CONTAINER="${MICARE_PG_CONTAINER:-micare-postgres}"
PGUSER="${MICARE_PG_USER:-postgres}"
PGDB="${MICARE_PG_DB:-postgres}"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
migrations_dir="$repo_root/supabase/migrations"

if [[ ! -d "$migrations_dir" ]]; then
  echo "No migrations directory at $migrations_dir" >&2
  exit 1
fi

psql_in_container() {
  docker exec -i "$CONTAINER" psql -U "$PGUSER" -d "$PGDB" -v ON_ERROR_STOP=1 "$@"
}

echo "Resetting public schema..."
psql_in_container <<'SQL'
drop schema if exists public cascade;
create schema public;
SQL

shopt -s nullglob
migrations=("$migrations_dir"/*.sql)
shopt -u nullglob

if (( ${#migrations[@]} == 0 )); then
  echo "No .sql files under $migrations_dir — nothing to apply." >&2
  exit 0
fi

for f in "${migrations[@]}"; do
  echo "Applying $(basename "$f")"
  psql_in_container < "$f"
done
