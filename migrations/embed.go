// Package migrations memuat berkas migrasi SQL (goose) ke dalam binary, sehingga
// migrasi saat start tidak bergantung pada filesystem container — root
// filesystem di cluster GONSU hanya-baca.
package migrations

import "embed"

// FS berisi seluruh berkas *.sql di direktori ini.
//
//go:embed *.sql
var FS embed.FS
