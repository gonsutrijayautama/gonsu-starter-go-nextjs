# Perintah pengembangan.
#
#   make run       server Go build dev di 127.0.0.1:18080 (API + frontend hasil build)
#   make web-dev   frontend dengan hot reload di http://localhost:3000
#   make build     frontend lalu binary rilis ke bin/
#   make db        database lokal (docker compose)
#   make migrate   migrasi ke database lokal
#   make generate  kode query sqlc dari migrations/ dan internal/*/queries.sql
#   make test      tes unit + integrasi, build rilis DAN build dev
#   make lint      backend dan frontend
#   make e2e       uji ujung ke ujung di peramban (Playwright)
#   make image     image rilis, Dockerfile yang sama dengan release.yml
#   make smoke     image rilis diuji di bawah batasan chart GONSU

PRODUCT := produk-contoh
VERSION ?= dev
COMPOSE := docker compose -f compose.dev.yaml
DEV_DB_PORT ?= 15432
DEV_HTTP_PORT ?= 18080
E2E_HTTP_PORT ?= 18091
DEV_DATABASE_URL := postgres://app:app@127.0.0.1:$(DEV_DB_PORT)/app?sslmode=disable
export DEV_DB_PORT E2E_HTTP_PORT

.PHONY: run web-dev web build db down migrate generate test lint e2e image smoke

## run: server Go build dev. Migrasi berjalan saat start; login pengembangan
## di /auth/login?as=administrator (atau staff, viewer).
run: db
	DATABASE_URL='$(DEV_DATABASE_URL)' DEV_HTTP_ADDR=127.0.0.1:$(DEV_HTTP_PORT) \
	  go run -tags dev ./cmd/api

## web-dev: frontend dengan hot reload; /v1, /auth, /media, dan /site.json
## diteruskan ke `make run`
web-dev:
	API_ORIGIN=http://127.0.0.1:$(DEV_HTTP_PORT) $(MAKE) -C web dev

## web: build frontend statis ke web/out, yang di-embed ke binary
web:
	$(MAKE) -C web build

## build: binary rilis dengan frontend di dalamnya
build: web
	go build -ldflags "-X main.version=$(VERSION)" -o bin/app ./cmd/api

## db: database lokal saja
db:
	$(COMPOSE) up -d --wait db

## down: menghentikan stack lokal (data database tetap di volume)
down:
	$(COMPOSE) down

## migrate: menjalankan migrasi ke database lokal
migrate: db
	DATABASE_URL='$(DEV_DATABASE_URL)' go run ./cmd/api migrate

## generate: kode query sqlc — hasilnya di-commit, jangan diedit tangan
generate:
	go tool sqlc generate

## test: unit + integrasi, untuk build rilis DAN build dev
test: db
	TEST_DATABASE_URL='$(DEV_DATABASE_URL)' go test -race ./...
	TEST_DATABASE_URL='$(DEV_DATABASE_URL)' go test -race -tags dev ./...

## lint: go vet, gofmt, lalu lint dan typecheck frontend
lint:
	go vet ./...
	go vet -tags dev ./...
	@out=$$(gofmt -l cmd internal migrations web/*.go); \
	  if [ -n "$$out" ]; then echo "belum di-gofmt:"; echo "$$out"; exit 1; fi
	$(MAKE) -C web lint

## e2e: server build dev dengan database app_e2e yang dibuat ulang, lalu uji
## peramban dari web/e2e terhadapnya (scripts/e2e.sh). Port E2E_HTTP_PORT.
e2e: web db
	scripts/e2e.sh

## image: image rilis lokal. Label versi dan revisi sama dengan release.yml.
image:
	docker build --build-arg VERSION=$(VERSION) \
	  --label org.opencontainers.image.version=$(VERSION) \
	  --label org.opencontainers.image.revision=$$(git rev-parse HEAD 2>/dev/null || echo unknown) \
	  -t $(PRODUCT):$(VERSION) .

## smoke: image rilis di bawah batasan chart GONSU — root filesystem
## hanya-baca, tanpa capability, UID 10001 — dengan database lokal
## (scripts/smoke.sh). Jalankan sebelum setiap tag rilis.
smoke: image db
	scripts/smoke.sh $(PRODUCT):$(VERSION) $(VERSION) "$$($(COMPOSE) ps -q db)"
