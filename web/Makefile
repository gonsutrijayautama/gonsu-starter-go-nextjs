# Perintah frontend. Dipanggil dari Makefile di akar project (`make web`,
# `make web-dev`, `make lint`), atau langsung: `make -C web build`.

.PHONY: install dev build lint e2e

node_modules: package.json bun.lock
	bun install --frozen-lockfile
	@touch node_modules

## install: dependency persis seperti bun.lock
install: node_modules

## dev: hot reload di http://localhost:3000; API_ORIGIN menunjuk server Go
dev: node_modules
	bun run dev

## build: static export ke out/, yang di-embed ke binary Go
build: node_modules
	bun run build

## lint: eslint (termasuk aturan docs/ui-guide.md), typecheck, dan judul halaman
lint: node_modules
	bun run lint
	bun run typecheck
	bun run check:pages

## e2e: uji peramban di e2e/ terhadap E2E_BASE_URL. Jalankan lewat `make e2e`
## di akar project, yang menyiapkan server dan databasenya.
e2e: node_modules
	@test -n "$(E2E_BASE_URL)" || { echo "E2E_BASE_URL kosong — jalankan make e2e dari akar project"; exit 1; }
	bunx playwright install chromium
	bunx playwright test
