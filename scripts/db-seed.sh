#!/usr/bin/env bash
# Apply db/seed.sql against the local Compose Postgres. The seed file
# is itself idempotent (ON CONFLICT DO NOTHING on natural keys), so
# this script does not need to drop or truncate first.

set -euo pipefail

CONTAINER="${MICARE_PG_CONTAINER:-micare-postgres}"
PGUSER="${MICARE_PG_USER:-postgres}"
PGDB="${MICARE_PG_DB:-postgres}"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
seed_file="$repo_root/db/seed.sql"

if [[ ! -f "$seed_file" ]]; then
  echo "Seed file not found at $seed_file" >&2
  exit 1
fi

echo "Seeding from $(basename "$seed_file")"
docker exec -i "$CONTAINER" psql -U "$PGUSER" -d "$PGDB" -v ON_ERROR_STOP=1 < "$seed_file"
