// Package security_test memeriksa syarat keamanan yang dapat
// diperiksa TANPA menjalankan satu permintaan pun — dengan membaca kode dan
// skema, bukan dengan mencoba satu jalur demi satu.
//
// Alasannya bukan kecepatan. Tes per modul menguji satu contoh: kalau modul
// ke-19 lupa menyaring tenant, tidak ada yang menangkapnya sampai seseorang
// menulis contoh ke-19. Pemeriksaan struktural di sini menutup SELURUH query
// yang ada sekarang dan seluruh yang ditambahkan besok, dan ia merah pada PR
// yang menambahkannya — bukan pada pilot.
package security_test

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// queryExceptions adalah query yang memang TIDAK menyaring organization_id,
// beserta alasannya. Menambah baris di sini berarti menyatakan sebuah query
// boleh melihat lintas tenant — dan itu pernyataan yang harus dibaca orang,
// bukan diselipkan.
var queryExceptions = map[string]string{
	// SESI. Kelimanya dikunci oleh KREDENSIALNYA sendiri — hash token dari
	// cookie, atau id sesi yang baru saja diturunkan dari hash itu. Menyaring
	// organization_id di sini berarti sudah mengetahui jawabannya sebelum
	// bertanya: justru baris sesi inilah yang MENENTUKAN tenant mana yang
	// dimasuki, bukan sebaliknya.
	//
	// Yang membuat ini aman bukan query-nya melainkan asal parameternya: tidak
	// satu pun menerima nilai yang dipilih client selain hash cookie-nya
	// sendiri. `sessionID` pada dua yang mengunci datang dari principal yang
	// baru diselesaikan `SessionPrincipal`.
	"SessionPrincipal":      "hash cookie yang menentukan tenant, bukan sebaliknya",
	"RevokeSession":         "id sesi datang dari principal yang baru diselesaikan",
	"RevokeSessionByToken":  "dikunci hash cookie itu sendiri",
	"LockSessionForRecheck": "id sesi datang dari principal yang baru diselesaikan",
	"RecordRecheck":         "id sesi datang dari principal yang baru diselesaikan",

	// Advisory lock; kuncinya sendiri sudah memuat organization_id.
	"LockUserGrants": "advisory lock, kuncinya sudah memuat organization_id",
}

// tenantTables menemukan tabel yang punya kolom organization_id dengan
// membaca migrasi — sumber yang sama dengan yang dijalankan aplikasi saat
// start, sehingga daftar ini tidak dapat menyimpang dari skema sebenarnya.
func tenantTables(t *testing.T) map[string]bool {
	t.Helper()
	sourceFiles, err := filepath.Glob("../../migrations/*.sql")
	if err != nil || len(sourceFiles) == 0 {
		t.Fatalf("migrasi tidak ditemukan: %v", err)
	}
	out := map[string]bool{}
	reCreate := regexp.MustCompile(`(?is)CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\((.*?)\n\);`)
	reAlter := regexp.MustCompile(`(?is)ALTER TABLE (\w+)(.*?);`)
	for _, f := range sourceFiles {
		raw, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		content := string(raw)
		for _, m := range reCreate.FindAllStringSubmatch(content, -1) {
			if strings.Contains(m[2], "organization_id") {
				out[m[1]] = true
			}
		}
		// Kolom yang ditambahkan belakangan ikut dihitung: tabel dapat
		// menjadi tenant-scoped di migrasi berikutnya.
		for _, m := range reAlter.FindAllStringSubmatch(content, -1) {
			if strings.Contains(m[2], "ADD COLUMN organization_id") {
				out[m[1]] = true
			}
		}
	}
	// Ambang kewajaran pengurai migrasi, bukan target. Naikkan seiring
	// tabel bertambah, supaya pengurai yang rusak tetap ketahuan.
	if len(out) < 5 {
		t.Fatalf("hanya %d tabel tenant-scoped terbaca — pengurai migrasi rusak", len(out))
	}
	return out
}

type query struct {
	module string
	name   string
	body   string
}

// queries membaca seluruh `internal/*/queries.sql` dan memecahnya per
// `-- name:`.
func queries(t *testing.T) []query {
	t.Helper()
	sourceFiles, err := filepath.Glob("../*/queries.sql")
	if err != nil || len(sourceFiles) == 0 {
		t.Fatalf("queries.sql tidak ditemukan: %v", err)
	}
	reName := regexp.MustCompile(`--\s*name:\s*(\w+)`)
	var out []query
	for _, f := range sourceFiles {
		raw, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		module := filepath.Base(filepath.Dir(f))
		bodies := reName.Split(string(raw), -1)
		names := reName.FindAllStringSubmatch(string(raw), -1)
		// bodies[0] adalah komentar kepala berkas, sebelum query pertama.
		for i, m := range names {
			out = append(out, query{module: module, name: m[1], body: bodies[i+1]})
		}
	}
	if len(out) < 30 {
		t.Fatalf("hanya %d query terbaca — pengurai rusak", len(out))
	}
	return out
}

// Akses lintas tenant wajib diuji, dan `organization_id` di setiap tabel dan
// query adalah pagar yang tidak boleh dilanggar.
//
// Yang diperiksa di sini bentuknya, bukan satu contoh jalurnya: SETIAP query
// yang menyentuh tabel tenant-scoped harus menyebut `organization_id`. Query
// yang lupa menyebutnya membaca seluruh pelanggan sekaligus — kebocoran yang
// tidak menimbulkan gejala apa pun sampai ada dua pelanggan di satu
// pemasangan, dan saat itu sudah terlambat.
func TestEveryQueryFiltersTenant(t *testing.T) {
	tables := tenantTables(t)
	reWord := regexp.MustCompile(`\b\w+\b`)

	checkedCount := 0
	for _, q := range queries(t) {
		if reason, present := queryExceptions[q.name]; present {
			if reason == "" {
				t.Errorf("%s.%s dikecualikan tanpa alasan tertulis", q.module, q.name)
			}
			continue
		}
		// Apakah query ini menyentuh tabel tenant-scoped?
		touched := ""
		for _, w := range reWord.FindAllString(q.body, -1) {
			if tables[w] {
				touched = w
				break
			}
		}
		if touched == "" {
			continue
		}
		checkedCount++
		if !strings.Contains(q.body, "organization_id") {
			t.Errorf("%s.%s menyentuh tabel %s tetapi tidak menyebut organization_id sama sekali",
				q.module, q.name, touched)
		}
	}
	if checkedCount < 20 {
		t.Fatalf("hanya %d query tenant-scoped diperiksa — terlalu sedikit untuk berarti", checkedCount)
	}
	t.Logf("%d query tenant-scoped diperiksa", checkedCount)
}

// Pengecualian yang sudah tidak ada query-nya adalah pengecualian yang
// menganggur — dan pengecualian menganggur akan cocok dengan query BARU yang
// kebetulan bernama sama, memberinya izin lintas tenant tanpa ada yang
// memutuskannya.
func TestExceptionsAreNotIdle(t *testing.T) {
	present := map[string]bool{}
	for _, q := range queries(t) {
		present[q.name] = true
	}
	var idleEntries []string
	for name := range queryExceptions {
		if !present[name] {
			idleEntries = append(idleEntries, name)
		}
	}
	sort.Strings(idleEntries)
	if len(idleEntries) > 0 {
		t.Errorf("pengecualian tanpa query-nya lagi: %v — hapus barisnya", idleEntries)
	}
}
