#!/usr/bin/env bash
# Backs up Nala's data from the compose `db` container to a gzipped SQL file (data only).
#
#   scripts/db-backup.sh [file]     default file: backups/nala-<UTC timestamp>.sql.gz
#
# The schema is not dumped: the API creates it from its EF Core migrations. Every table of the public
# schema is dumped except __EFMigrationsHistory, so new tables are picked up without editing this script.
# The first line records the latest applied migration; scripts/db-restore.sh only restores into a database
# on that same migration. Run from any directory, with the stack up (`docker compose up -d`).
# Keep in sync with the schema: see "Backup scripts" in api/CLAUDE.md.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-$repo/backups/nala-$(date -u +%Y%m%dT%H%M%SZ).sql.gz}"
cd "$repo"

db() { docker compose exec -T db sh -c "$1"; }

migration="$(db 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAX -v ON_ERROR_STOP=1 \
  -c "SELECT \"MigrationId\" FROM \"__EFMigrationsHistory\" ORDER BY \"MigrationId\" DESC LIMIT 1"')"
[ -n "$migration" ] || { echo "db-backup: no migration applied yet, start the API once first" >&2; exit 1; }

mkdir -p "$(dirname "$out")"
tmp="$out.partial"
trap 'rm -f "$tmp"' EXIT
{
  echo "-- nala-backup migration=$migration"
  echo "-- created $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  db 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --data-only --disable-triggers --no-owner --no-privileges \
    --schema=public --exclude-table=public.\"__EFMigrationsHistory\"'
} | gzip >"$tmp"
mv "$tmp" "$out"
echo "Backup written to $out (migration $migration)"
