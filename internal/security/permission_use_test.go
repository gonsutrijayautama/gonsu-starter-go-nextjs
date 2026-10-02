package security_test

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authz"
)

// Izin yang DIDEFINISIKAN tetapi tidak pernah ditegakkan adalah izin yang
// tidak menjaga apa pun — dan jauh lebih buruk daripada tidak ada, karena ia
// muncul di `/v1/me`, muncul di matriks authz, dan membuat orang mengira
// ada pintu yang dijaga.
//
// Ini kelas yang sama dengan tiga hal lain yang ditemukan hari ini: endpoint
// yang ada tanpa layarnya, kode galat yang ada tanpa yang menghasilkannya, dan
// komentar yang menjelaskan pembatasan yang sudah tidak berlaku. Bentuknya
// selalu sama — **permukaan yang terlihat jadi, tanpa yang di belakangnya** —
// dan tidak satu pun dapat ditangkap tes biasa, karena tidak ada yang gagal.
func TestEveryPermissionIsEnforced(t *testing.T) {
	// Di mana izin ditegakkan: `authn.Check(ctx, authz.X)` di service, atau
	// `Can(role, X)` saat menghitung `actions`.
	used := map[string]bool{}
	rePermission := regexp.MustCompile(`authz\.([A-Z]\w+)`)

	sourceFiles, err := filepath.Glob("../*/*.go")
	if err != nil {
		t.Fatal(err)
	}
	moreFiles, _ := filepath.Glob("../../cmd/*/*.go")
	sourceFiles = append(sourceFiles, moreFiles...)

	for _, f := range sourceFiles {
		// Definisinya sendiri dan tes tidak dihitung sebagai pemakaian:
		// kalau dihitung, setiap izin akan tampak dipakai oleh barisnya
		// sendiri dan pemeriksaan ini tidak memeriksa apa pun.
		if strings.Contains(f, "/authz/") || strings.HasSuffix(f, "_test.go") {
			continue
		}
		raw, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		for _, m := range rePermission.FindAllStringSubmatch(string(raw), -1) {
			used[m[1]] = true
		}
	}

	// Nama konstanta Go untuk setiap izin, dibaca dari sumbernya.
	raw, err := os.ReadFile("../authz/authz.go")
	if err != nil {
		t.Fatal(err)
	}
	reConstant := regexp.MustCompile(`(?m)^\t(\w+)\s+Permission = "([^"]+)"`)
	all := reConstant.FindAllStringSubmatch(string(raw), -1)
	// Ambang kewajaran pengurai, bukan target: template memulai dengan
	// tiga izin. Naikkan bersama matriks authz.
	if len(all) < 3 {
		t.Fatalf("hanya %d izin terbaca — pengurai rusak", len(all))
	}

	var idleEntries []string
	for _, m := range all {
		if !used[m[1]] {
			idleEntries = append(idleEntries, m[1]+" ("+m[2]+")")
		}
	}
	sort.Strings(idleEntries)
	if len(idleEntries) > 0 {
		t.Errorf("izin yang tidak pernah ditegakkan di mana pun:\n  %s\n"+
			"Izin yang tidak menjaga apa pun lebih buruk daripada tidak ada: ia muncul "+
			"di /v1/me dan membuat orang mengira ada pintu yang dijaga.",
			strings.Join(idleEntries, "\n  "))
	}
	t.Logf("%d izin, seluruhnya ditegakkan", len(all))
}

// Sebaliknya: izin yang ditegakkan tetapi tidak diberikan kepada SATU pun role
// adalah pintu yang tidak dapat dilewati siapa pun. Fiturnya ada, tesnya
// hijau, dan tidak seorang pun dapat memakainya — persis lubang
// `customer_viewer` yang ditemukan di PRT-3.
func TestEveryPermissionHasARole(t *testing.T) {
	var orphans []authz.Permission
	for _, p := range definedPermissions(t) {
		present := false
		for _, role := range authz.Roles {
			if authz.Can(role, p) {
				present = true
				break
			}
		}
		if !present {
			orphans = append(orphans, p)
		}
	}
	if len(orphans) > 0 {
		t.Errorf("izin yang tidak dipegang satu role pun: %v\n"+
			"Fiturnya ada dan tidak seorang pun dapat memakainya.", orphans)
	}
}

func definedPermissions(t *testing.T) []authz.Permission {
	t.Helper()
	raw, err := os.ReadFile("../authz/authz.go")
	if err != nil {
		t.Fatal(err)
	}
	re := regexp.MustCompile(`(?m)^\t\w+\s+Permission = "([^"]+)"`)
	m := re.FindAllStringSubmatch(string(raw), -1)
	out := make([]authz.Permission, 0, len(m))
	for _, x := range m {
		out = append(out, authz.Permission(x[1]))
	}
	return out
}
