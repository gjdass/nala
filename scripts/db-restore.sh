#!/usr/bin/env bash
# Restores a backup made by scripts/db-backup.sh into the compose `db` container.
#
#   scripts/db-restore.sh <file>
#
# The target database must already have the schema: start the stack once on an empty volume so the API
# applies its migrations. The restore is refused when the target is on another migration than the backup
# (check out the commit the backup was made with, or restore there and then update), or when any table
# already holds data. It runs in a single transaction: on any error nothing is written.
# Keep in sync with the schema: see "Backup scripts" in api/CLAUDE.md.
set -euo pipefail

[ $# -eq 1 ] && [ -f "$1" ] || { echo "usage: $0 <backup.sql.gz>" >&2; exit 2; }
file="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
repo="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo"

fail() { echo "db-restore: $*" >&2; exit 1; }
psql_db() { docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 '"$1"; }

wanted="$(gunzip -c "$file" | head -1 | sed -n 's/^-- nala-backup migration=//p')"
[ -n "$wanted" ] || fail "$1 is not a Nala backup (no migration header)"

current="$(psql_db '-tAX -c "SELECT \"MigrationId\" FROM \"__EFMigrationsHistory\" ORDER BY \"MigrationId\" DESC LIMIT 1"' 2>/dev/null || true)"
[ -n "$current" ] || fail "the database has no schema yet: start the API once so it applies its migrations"
[ "$current" = "$wanted" ] \
  || fail "migration mismatch: the backup is at $wanted, the database at $current. Restore with the app version the backup was made with."

nonempty="$(psql_db "-tAX -c \"SELECT string_agg(tablename, ', ' ORDER BY tablename) FROM pg_tables
  WHERE schemaname = 'public' AND tablename <> '__EFMigrationsHistory'
    AND (xpath('/row/c/text()', query_to_xml(format('SELECT EXISTS (SELECT 1 FROM public.%I) AS c', tablename), false, true, '')))[1]::text = 'true'\"")"
[ -z "$nonempty" ] || fail "the database is not empty (data in: $nonempty). Restore into a fresh database only."

gunzip -c "$file" | psql_db '-q --single-transaction' >/dev/null
echo "Backup $1 restored (migration $wanted)"
