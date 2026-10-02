#!/usr/bin/env bash
# Uji asap image RILIS di bawah batasan yang diberlakukan chart GONSU: root
# filesystem hanya-baca, tanpa capability, tanpa eskalasi hak. Pelanggarannya
# harus terlihat di laptop atau di PR, bukan pertama kali di cluster pelanggan.
#
#   scripts/smoke.sh <image> <versi> <id container database>
#
# Dipanggil `make smoke` (lokal dan CI), yang menyiapkan ketiganya. Container
# produk bergabung ke network database itu dan memigrasikan database `app` di
# sana, sama seperti `make run`.
set -euo pipefail

image=$1 version=$2 db=$3
[ -n "$db" ] || { echo "smoke: database lokal tidak berjalan — jalankan lewat make smoke" >&2; exit 1; }

network=$(docker inspect -f '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{end}}' "$db")
name="smoke-$$"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

fail() {
  echo "smoke: $*" >&2
  echo "--- log container ---" >&2
  docker logs "$name" >&2 || true
  exit 1
}

docker run -d --name "$name" --network "$network" \
  -e DATABASE_URL='postgres://app:app@db:5432/app?sslmode=disable' \
  --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true \
  -p 127.0.0.1::8080 "$image" >/dev/null
port=$(docker port "$name" 8080/tcp | head -n1)
base="http://127.0.0.1:${port##*:}"

# Tanpa -L: redirect harus terbaca sebagai kegagalan, bukan diikuti.
code=""
for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$base/" || true)
  [ "$code" = 200 ] && break
  sleep 1
done
[ "$code" = 200 ] || fail "GET / menjawab ${code:-tanpa respons}, harus 200 (probe chart GONSU)"

health=$(curl -s "$base/healthz")
case "$health" in
  *"\"version\":\"$version\""*) ;;
  *) fail "/healthz tidak menyebut versi $version: $health" ;;
esac

# Image rilis tidak boleh membawa login pengembangan: /auth/login selalu menuju
# jalur masuk GONSU dan tidak pernah menerbitkan sesi, termasuk untuk ?as=.
login=$(curl -s -o /dev/null -D - "$base/auth/login?as=administrator")
if grep -qi '^set-cookie:' <<<"$login"; then
  fail "/auth/login?as=administrator menerbitkan cookie; login pengembangan ikut ke image rilis"
fi
grep -qi '^location: /auth/gonsu/login' <<<"$login" \
  || fail "/auth/login tidak menuju jalur masuk GONSU: $login"

# Tanpa konfigurasi login GONSU, jalur masuknya menunjuk halaman yang menyebut
# sebabnya — bukan 404, yang membuat tombol "Buka aplikasi" di Portal buntu.
gonsu=$(curl -s -o /dev/null -D - "$base/auth/gonsu/login")
if grep -qi '^set-cookie:' <<<"$gonsu"; then
  fail "/auth/gonsu/login menerbitkan cookie tanpa login GONSU"
fi
grep -qi '^location: /sign-in/?error=not-configured' <<<"$gonsu" \
  || fail "/auth/gonsu/login tanpa konfigurasi tidak menunjuk /sign-in/: $gonsu"

user=$(docker inspect -f '{{.Config.User}}' "$image")
[ "$user" = "10001:10001" ] || fail "image berjalan sebagai '$user', harus 10001:10001 (runAsUser chart GONSU)"

echo "smoke: GET / 200, /healthz versi $version, tanpa login pengembangan, UID 10001, filesystem hanya-baca"
