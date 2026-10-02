#!/usr/bin/env bash
# Uji ujung ke ujung: server build dev — dengan login pengembangan
# /auth/login?as=<role> — di atas database app_e2e yang dibuat ulang setiap
# kali, lalu uji peramban frontend (`make -C web e2e`) terhadapnya.
#
# Dipanggil `make e2e` (lokal dan CI), sesudah frontend di-build dan database
# lokal berjalan. Data pengembangan di database `app` tidak disentuh.
set -euo pipefail

port=${E2E_HTTP_PORT:-18091}
db_port=${DEV_DB_PORT:-15432}
compose=(docker compose -f compose.dev.yaml)

"${compose[@]}" exec -T db dropdb -U app --if-exists --force app_e2e
"${compose[@]}" exec -T db createdb -U app app_e2e

mkdir -p bin
go build -tags dev -o bin/app-e2e ./cmd/api

log=bin/e2e-server.log
DATABASE_URL="postgres://app:app@127.0.0.1:$db_port/app_e2e?sslmode=disable" \
  DEV_HTTP_ADDR="127.0.0.1:$port" bin/app-e2e >"$log" 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true; wait "$server" 2>/dev/null || true' EXIT

base="http://127.0.0.1:$port"
for _ in $(seq 1 60); do
  curl -sf "$base/healthz" >/dev/null && break
  kill -0 "$server" 2>/dev/null || break
  sleep 1
done
if ! curl -sf "$base/healthz" >/dev/null; then
  echo "e2e: server tidak siap di $base" >&2
  cat "$log" >&2
  exit 1
fi

if ! E2E_BASE_URL="$base" make -C web e2e; then
  echo "e2e: gagal — log server di $log, jejak Playwright di web/test-results" >&2
  exit 1
fi
