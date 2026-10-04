#!/usr/bin/env bash
# End-to-end deployment check: builds and starts the stack from a simulated clean
# clone (tracked + unignored files and .git), then checks nginx, the SPA fallback,
# the API health through the single published port and the commit stamped in the
# web build. Needs Docker.
set -euo pipefail

repo="$(cd "$(dirname "$0")/../.." && pwd)"
work="$(mktemp -d)"
project="nala-smoke-$$"
port="${SMOKE_PORT:-18080}"

cleanup() {
  (cd "$work" && docker compose -p "$project" down -v --remove-orphans >/dev/null 2>&1) || true
  rm -rf "$work"
}
trap cleanup EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }

echo "Copying a clean tree to $work"
(cd "$repo" && git ls-files -z --cached --others --exclude-standard \
  | while IFS= read -r -d '' f; do [ -e "$f" ] && printf '%s\0' "$f"; done \
  | rsync -a --from0 --files-from=- ./ "$work/" \
  && rsync -a .git "$work/")
commit="$(git -C "$repo" rev-parse --short HEAD)"

cd "$work"
cp .env.example .env
sed -i.bak "s/^NALA_HTTP_PORT=.*/NALA_HTTP_PORT=$port/" .env && rm .env.bak

docker compose -p "$project" up -d --build

base="http://localhost:$port"

echo "Waiting for $base/api/health"
health=""
for _ in $(seq 1 60); do
  health="$(curl -fsS "$base/api/health" 2>/dev/null || true)"
  [ "$health" = '{"status":"ok"}' ] && break
  sleep 2
done
[ "$health" = '{"status":"ok"}' ] || { docker compose -p "$project" logs; fail "/api/health returned '$health'"; }
echo "ok: /api/health -> $health"

index="$(curl -fsS "$base/")" || fail "GET / failed"
grep -q '<nala-root' <<<"$index" || fail "GET / is not the Angular index.html"
echo "ok: / serves index.html"

deep="$(curl -fsS "$base/some/deep/link")" || fail "GET /some/deep/link failed"
[ "$deep" = "$index" ] || fail "SPA fallback does not serve index.html"
echo "ok: SPA fallback"

curl -fsS -o /dev/null "$base/ngsw.json" || fail "GET /ngsw.json failed (no service worker build?)"
echo "ok: service worker manifest served"

docker compose -p "$project" exec -T web sh -c "grep -lq \"$commit\" /usr/share/nginx/html/*.js" \
  || fail "the web build is not stamped with commit $commit"
echo "ok: web build stamped with commit $commit"

echo "Smoke test passed"
