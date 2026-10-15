#!/usr/bin/env bash
# Backup/restore check: starts the stack from a simulated clean clone, creates data, backs it up with
# scripts/db-backup.sh, wipes the database, lets the API recreate the schema and restores the backup with
# scripts/db-restore.sh. Checks the data round-trips, the account can sign in again, and that a restore is
# refused into a non-empty database or a database on another migration. Needs Docker.
set -euo pipefail

repo="$(cd "$(dirname "$0")/../.." && pwd)"
work="$(mktemp -d)"
project="nala-backup-$$"
port="${BACKUP_TEST_PORT:-18081}"
export COMPOSE_PROJECT_NAME="$project"

cleanup() {
  (cd "$work" && docker compose down -v --remove-orphans >/dev/null 2>&1) || true
  rm -rf "$work"
}
trap cleanup EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }

echo "Copying a clean tree to $work"
(cd "$repo" && git ls-files -z --cached --others --exclude-standard \
  | while IFS= read -r -d '' f; do [ -e "$f" ] && printf '%s\0' "$f"; done \
  | rsync -a --from0 --files-from=- ./ "$work/" \
  && rsync -a .git "$work/")

cd "$work"
cp .env.example .env
sed -i.bak "s/^NALA_HTTP_PORT=.*/NALA_HTTP_PORT=$port/" .env && rm .env.bak

base="http://localhost:$port"

wait_healthy() {
  local health=""
  for _ in $(seq 1 60); do
    health="$(curl -fsS "$base/api/health" 2>/dev/null || true)"
    [ "$health" = '{"status":"ok"}' ] && return 0
    sleep 2
  done
  docker compose logs
  fail "/api/health returned '$health'"
}

post() { curl -sS -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -d "$2" "$base$1"; }

account='{"email":"parent@example.com","password":"correct horse battery"}'

docker compose up -d --build
wait_healthy

status="$(post /api/auth/setup '{"email":"parent@example.com","displayName":"Parent","password":"correct horse battery","language":"en","familyName":"Backup family"}')"
[ "$status" = 200 ] || fail "setup returned $status"
echo "ok: data created"

scripts/db-backup.sh "$work/first.sql.gz" || fail "db-backup.sh failed"
[ -s "$work/first.sql.gz" ] || fail "the backup file is empty"
gunzip -c "$work/first.sql.gz" | head -1 | grep -q '^-- nala-backup migration=[0-9]' \
  || fail "the backup does not record its migration"
gunzip -c "$work/first.sql.gz" | grep -q 'Backup family' || fail "the backup does not contain the family"
echo "ok: backup written"

if scripts/db-restore.sh "$work/first.sql.gz" 2>"$work/err"; then fail "restore into a non-empty database succeeded"; fi
grep -qi 'not empty' "$work/err" || fail "unexpected refusal: $(cat "$work/err")"
echo "ok: restore refused into a non-empty database"

docker compose down -v
docker compose up -d
wait_healthy
echo "ok: fresh database, schema created by the API"

gunzip -c "$work/first.sql.gz" | sed '1s/migration=.*/migration=00000000000000_Other/' | gzip >"$work/other.sql.gz"
if scripts/db-restore.sh "$work/other.sql.gz" 2>"$work/err"; then fail "restore across migrations succeeded"; fi
grep -qi 'migration' "$work/err" || fail "unexpected refusal: $(cat "$work/err")"
echo "ok: restore refused across migrations"

scripts/db-restore.sh "$work/first.sql.gz" || fail "db-restore.sh failed"
echo "ok: backup restored"

scripts/db-backup.sh "$work/second.sql.gz" || fail "second backup failed"
# pg_dump stamps each dump with a random \restrict key; everything else must match.
diff <(gunzip -c "$work/first.sql.gz" | grep -vE '^(--|\\(un)?restrict )') <(gunzip -c "$work/second.sql.gz" | grep -vE '^(--|\\(un)?restrict )') \
  || fail "the restored data differs from the backup"
echo "ok: restored data matches the backup"

status="$(post /api/auth/login "$account")"
[ "$status" = 200 ] || fail "login after restore returned $status"
echo "ok: the restored account signs in"

echo "Backup/restore test passed"
