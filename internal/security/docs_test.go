package security_test

import (
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"unicode"
)

// root adalah akar project, dilihat dari package ini.
const root = "../.."

// skipDir: folder yang bukan kode project — dependency, hasil build, git.
func skipDir(name string) bool {
	switch name {
	case ".git", "node_modules", ".next", "out", "bin", "dist", "test-results", "playwright-report":
		return true
	}
	return false
}

var (
	reCode = regexp.MustCompile("`([^`\n]+)`")
	// rePath: path di dalam project, relatif terhadap folder dokumennya —
	// `internal/authn/users.go` di akar, `app/(app)/notes/` di web/ — beserta
	// berkas di akar yang sering disebut (`Dockerfile`).
	rePath = regexp.MustCompile(`^(cmd|internal|migrations|web|app|components|lib|hooks|fonts|docs|scripts|e2e|\.github)(/[\w().-]+)*/?$|^(Dockerfile|Makefile|compose\.dev\.yaml)$`)
	// reSymbol: simbol berpaket, misalnya `httpx.ReadBody` atau `notes.Create`.
	reSymbol = regexp.MustCompile(`^([a-z]+)\.([A-Z]\w*)$`)
	// reTest: nama test yang disebut sebagai contoh.
	reTest = regexp.MustCompile(`^Test\w+$`)
)

// Dokumen project — README dan instruksi agen — hanya menyebut path, simbol,
// dan test yang benar-benar ada. Agen yang mengikuti resep ke fungsi yang
// sudah berganti nama akan menebak, dan tebakannya menyimpang dari pola.
//
// Contoh yang sengaja belum ada (`invoices`), pola (`<module>`, `*`), dan
// simbol dari luar project (`context.Context`) dilewati.
func TestDocsReferToExistingCode(t *testing.T) {
	source := goSource(t)
	for _, doc := range []string{"AGENTS.md", "README.md", "web/AGENTS.md", "web/docs/ui-guide.md"} {
		raw, err := os.ReadFile(filepath.Join(root, doc))
		if err != nil {
			t.Fatal(err)
		}
		checked := 0
		for _, m := range reCode.FindAllStringSubmatch(string(raw), -1) {
			ref := m[1]
			if strings.ContainsAny(ref, "<*") || strings.Contains(ref, "invoices") {
				continue
			}
			switch {
			case rePath.MatchString(ref):
				checked++
				if !existsAny(doc, ref) {
					t.Errorf("%s menyebut %s, yang tidak ada di project", doc, ref)
				}
			case reSymbol.MatchString(ref):
				s := reSymbol.FindStringSubmatch(ref)
				if _, ours := source[s[1]]; !ours {
					continue // paket pustaka standar atau dependency
				}
				checked++
				if !declares(source[s[1]], s[2]) {
					t.Errorf("%s menyebut %s, yang tidak dideklarasikan di paket %s", doc, ref, s[1])
				}
			case reTest.MatchString(ref):
				checked++
				found := false
				for _, src := range source {
					found = found || strings.Contains(src, "func "+ref+"(")
				}
				if !found {
					t.Errorf("%s menyebut %s, test yang tidak ada", doc, ref)
				}
			}
		}
		if checked < 10 {
			t.Errorf("%s: hanya %d rujukan diperiksa — pengurai rusak?", doc, checked)
		}
	}
}

// goSource mengumpulkan isi berkas Go project per nama paket (nama folder
// terakhir).
func goSource(t *testing.T) map[string]string {
	t.Helper()
	out := map[string]string{}
	err := filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if skipDir(d.Name()) {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(p, ".go") {
			return nil
		}
		raw, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		out[filepath.Base(filepath.Dir(p))] += string(raw) + "\n"
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return out
}

// declares melaporkan apakah src mendeklarasikan name sebagai fungsi, method,
// tipe, konstanta, atau variabel.
func declares(src, name string) bool {
	re := regexp.MustCompile(`(?m)^(func (\([^)]*\) )?` + name + `\(|type ` + name + `\b|\t` + name + `\s|(const|var) ` + name + `\b)`)
	return re.MatchString(src)
}

// existsAny: ref ada relatif terhadap folder dokumen atau salah satu folder
// di atasnya sampai akar project (`web/docs/ui-guide.md` menyebut
// `lib/api.ts` milik `web/`), apa adanya atau dengan ekstensi TypeScript.
func existsAny(doc, ref string) bool {
	for rel := filepath.Dir(doc); ; rel = filepath.Dir(rel) {
		for _, ext := range []string{"", ".tsx", ".ts"} {
			if _, err := os.Stat(filepath.Join(root, rel, ref+ext)); err == nil {
				return true
			}
		}
		if rel == "." {
			return false
		}
	}
}

// indonesianWords adalah kata Indonesia yang paling sering terbawa dari
// komentar ke nama berkas. Penjaga yang murah, bukan kamus: kata yang lolos
// dari daftar ini tetap pelanggaran.
var indonesianWords = map[string]bool{
	"akses": true, "akun": true, "baru": true, "batas": true, "berkas": true,
	"buat": true, "catatan": true, "contoh": true, "daftar": true, "dan": true,
	"formulir": true, "galat": true, "halaman": true, "hapus": true,
	"identitas": true, "izin": true, "keluar": true, "kontrak": true,
	"kunci": true, "layar": true, "lisensi": true, "masuk": true, "modul": true,
	"nama": true, "pemasangan": true, "pengaturan": true, "pengguna": true,
	"pesan": true, "rilis": true, "sesi": true, "siklus": true, "simpan": true,
	"tombol": true, "ubah": true, "uji": true, "yang": true,
}

// Nama berkas dan folder project dalam bahasa Inggris, termasuk migrasi.
// Komentar dan teks layar boleh berbahasa Indonesia; nama berkas tidak.
func TestFileNamesAreEnglish(t *testing.T) {
	err := filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() && skipDir(d.Name()) {
			return filepath.SkipDir
		}
		rel, _ := filepath.Rel(root, p)
		notLetter := func(r rune) bool { return !unicode.IsLetter(r) }
		for _, word := range strings.FieldsFunc(strings.ToLower(d.Name()), notLetter) {
			if indonesianWords[word] {
				t.Errorf("%s: %q berbahasa Indonesia — nama berkas wajib bahasa Inggris", rel, word)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
