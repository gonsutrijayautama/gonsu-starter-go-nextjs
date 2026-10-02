# Image rilis produk-contoh.
#
# Kontrak produk GONSU: SATU container image — satu binary Go yang mendengar di
# 8080, menjawab 200 di GET / tanpa login, membaca DATABASE_URL, menjalankan
# migrasi saat start, dan menyajikan frontend statis dari dalam dirinya sendiri.
#
#   make image VERSION=1.2.3     lokal (lalu `make smoke` untuk mengujinya)
#   git tag v1.2.3 && git push origin v1.2.3     rilis, lewat release.yml
#
# Keduanya memakai Dockerfile ini apa adanya. Label versi dan revisi diberikan
# dari luar (`--label`), bukan di sini: label itu yang membuat setiap versi
# punya digest sendiri, dan GONSU menolak digest yang sudah terdaftar untuk
# versi lain.
#
# Base image disematkan dengan digest supaya tag yang berpindah tidak diam-diam
# mengganti isinya. Memperbarui digest adalah perubahan yang direview.

# --- 1. Frontend -------------------------------------------------------------
# Kontraknya dengan folder web/: `bun run build` menghasilkan berkas statis di
# web/out. bun tidak ikut ke image akhir.
FROM oven/bun:1.4.0@sha256:5ff609364c049b54eb0ff560ec96319729a972078ef2c755d758f0c6ef89c2d6 AS web
WORKDIR /src/web
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile
COPY web/ ./
ENV NEXT_TELEMETRY_DISABLED=1
# --bun: image ini tidak membawa Node, jadi build berjalan di runtime bun.
#
# Tanpa index.html binary tetap jadi dan "/" jatuh ke halaman cadangan. Untuk
# rilis itu salah, jadi build dihentikan di sini.
RUN bun --bun run build && test -f out/index.html

# --- 2. Binary ---------------------------------------------------------------
FROM golang:1.27.1-alpine@sha256:cf6fca6641884b8433441b2b0652976f975e1d0fdd26d177eaaf8596087f3125 AS api
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd/ cmd/
COPY internal/ internal/
COPY migrations/ migrations/
COPY web/*.go web/
COPY --from=web /src/web/out/ web/out/
ARG VERSION=dev
# Tanpa tag `dev`: login pengembangan (/auth/login?as=<role>) secara fisik
# tidak ikut ke binary. Jangan pernah menambahkan -tags dev di sini.
RUN CGO_ENABLED=0 go build -trimpath \
      -ldflags "-s -w -X main.version=${VERSION}" \
      -o /out/app ./cmd/api

# --- 3. Runtime --------------------------------------------------------------
FROM alpine:3.24@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b

# Paket sistem diperbarui saat build. Base image yang disematkan tetap membawa
# kerentanan yang perbaikannya keluar sesudah image itu dibuat, dan itulah
# penyebab paling umum rilis pertama tertahan pemindaian GONSU.
RUN apk upgrade --no-cache

COPY --from=api /out/app /usr/local/bin/produk-contoh

# UID yang sama dengan chart GONSU (runAsUser 10001). Angka, bukan nama:
# runAsNonRoot di Kubernetes hanya dapat dibuktikan dari UID numerik. Binary
# tidak menulis ke filesystem, jadi root filesystem hanya-baca pada chart tidak
# menjadi masalah — `make smoke` membuktikannya.
USER 10001:10001

EXPOSE 8080

# Untuk docker/compose; di cluster, chart memakai probe-nya sendiri. start-period
# memberi waktu untuk migrasi saat start.
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

ENTRYPOINT ["/usr/local/bin/produk-contoh"]
