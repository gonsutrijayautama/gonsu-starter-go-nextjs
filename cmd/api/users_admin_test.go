package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authn"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authz"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/config"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/testdb"
)

// fakeIdentities menyajikan POST /v1/identities seperti agent GONSU One
// (bentuk yang sama dengan /license/v1/identities GONSU): akun baru mendapat
// sandi sementara, akun yang sudah ada tidak. GET /v1/license menjawab
// license bila diisi; jalur lain 404, seperti agent yang belum siap.
type fakeIdentities struct {
	srv     *httptest.Server
	calls   atomic.Int32
	status  atomic.Int32
	license atomic.Value // string, jawaban GET /v1/license
	mu      sync.Mutex
	known   map[string]string // email → subject
	auth    atomic.Value      // Authorization terakhir
	path    atomic.Value
}

func newFakeIdentities(t *testing.T, preexisting ...string) *fakeIdentities {
	t.Helper()
	f := &fakeIdentities{known: map[string]string{}}
	for _, e := range preexisting {
		f.known[e] = "usr_" + strings.Split(e, "@")[0]
	}
	f.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet && r.URL.Path == "/v1/license" {
			if body, _ := f.license.Load().(string); body != "" {
				_, _ = io.WriteString(w, body)
				return
			}
		}
		if r.Method != http.MethodPost || !strings.HasSuffix(r.URL.Path, "/v1/identities") {
			http.NotFound(w, r)
			return
		}
		f.calls.Add(1)
		f.auth.Store(r.Header.Get("Authorization"))
		f.path.Store(r.URL.Path)
		if s := f.status.Load(); s != 0 {
			writeTestJSON(w, int(s), map[string]any{"error": map[string]string{
				"code": "ditolak", "message": "Kalimat dari GONSU untuk status ini."}})
			return
		}
		var body struct{ Email, DisplayName string }
		_ = json.NewDecoder(r.Body).Decode(&body)
		f.mu.Lock()
		defer f.mu.Unlock()
		resp := map[string]any{"email": body.Email, "display_name": body.DisplayName}
		if sub, ok := f.known[body.Email]; ok {
			resp["subject"] = sub
		} else {
			sub = "usr_" + strings.Split(body.Email, "@")[0]
			f.known[body.Email] = sub
			resp["subject"] = sub
			resp["temporary_password"] = "Sandi-Sementara-9x7Q"
		}
		writeTestJSON(w, 200, resp)
	}))
	t.Cleanup(f.srv.Close)
	return f
}

type usersApp struct {
	h     http.Handler
	pool  *pgxpool.Pool
	admin *http.Cookie
	p     authn.Principal
}

// agentAt: pemasangan self-host dengan agent di f — jalan pemberian akses
// ikut agent.
func agentAt(f *fakeIdentities) config.Config {
	return config.Config{Getenv: env(map[string]string{"GONSU_AGENT_URL": f.srv.URL})}
}

// newUsersApp: aplikasi dengan konfigurasi cfg (config.Config{} = tanpa jalan
// pemberian akses).
func newUsersApp(t *testing.T, cfg config.Config) usersApp {
	t.Helper()
	pool := testdb.New(t)
	h := newAppWith(t, pool, cfg)
	_, p := testdb.Tenant(t, pool, authz.RoleAdministrator)
	return usersApp{h: h, pool: pool, admin: sessionFor(t, pool, p, time.Hour), p: p}
}

func (a usersApp) call(t *testing.T, method, path, body string, c *http.Cookie) (*http.Response, map[string]any) {
	t.Helper()
	resp := do(t, a.h, call{method: method, path: path, body: body, cookie: c})
	raw, _ := io.ReadAll(resp.Body)
	var out map[string]any
	_ = json.Unmarshal(raw, &out)
	return resp, out
}

func errCode(body map[string]any) string {
	e, _ := body["error"].(map[string]any)
	s, _ := e["code"].(string)
	return s
}

func countRows(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) int {
	t.Helper()
	var n int
	if err := pool.QueryRow(context.Background(), sql, args...).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestInviteGrantsAccessThroughGonsu(t *testing.T) {
	f := newFakeIdentities(t, "budi@example.test")
	a := newUsersApp(t, agentAt(f))

	_, list := a.call(t, http.MethodGet, "/v1/users", "", a.admin)
	invite, _ := list["invite"].(map[string]any)
	seats, _ := list["seats"].(map[string]any)
	if invite["available"] != true || seats["active"] != float64(1) || seats["max"] != nil {
		t.Fatalf("daftar awal = %v", list)
	}

	resp, body := a.call(t, http.MethodPost, "/v1/users",
		`{"email":"siti@example.test","display_name":"  Siti   Aminah ","role":"staff"}`, a.admin)
	user, _ := body["user"].(map[string]any)
	if resp.StatusCode != 201 || body["account"] != "created" || body["temporary_password"] != "Sandi-Sementara-9x7Q" ||
		user["role"] != "staff" || user["status"] != "ACTIVE" || user["subject"] != "usr_siti" || user["name"] != "Siti Aminah" {
		t.Fatalf("beri akses = %d %v", resp.StatusCode, body)
	}
	if resp.Header.Get("Cache-Control") != "no-store" {
		t.Error("jawaban yang membawa sandi sementara boleh di-cache")
	}

	// Sandi sementara tidak pernah tersimpan di database produk.
	if n := countRows(t, a.pool, `SELECT count(*) FROM idempotency_keys`); n != 0 {
		t.Errorf("jawaban pemberian akses tersimpan di idempotency_keys: %d", n)
	}
	if n := countRows(t, a.pool, `SELECT count(*) FROM application_users u, user_access_events e
		WHERE u.name LIKE '%Sandi%' OR u.email LIKE '%Sandi%' OR e.actor_name LIKE '%Sandi%'`); n != 0 {
		t.Error("sandi sementara tersimpan")
	}
	if n := countRows(t, a.pool, `SELECT count(*) FROM user_access_events e JOIN application_users u
		ON u.id = e.application_user_id WHERE u.external_subject = 'usr_siti' AND e.action = 'GRANTED'
		AND e.source = 'SCREEN' AND e.actor_user_id = $1`, a.p.UserID); n != 1 {
		t.Errorf("riwayat pemberian akses = %d baris", n)
	}

	// Orang yang sama diminta lagi: sudah punya akses, tidak diubah diam-diam.
	resp, body = a.call(t, http.MethodPost, "/v1/users",
		`{"email":"siti@example.test","display_name":"Siti","role":"viewer"}`, a.admin)
	if resp.StatusCode != 400 || errCode(body) != apperr.CodeValidationFailed {
		t.Errorf("beri akses kedua = %d %v", resp.StatusCode, body)
	}

	// Orang yang sudah punya akun GONSU: tanpa sandi sementara, dan itu bukan galat.
	resp, body = a.call(t, http.MethodPost, "/v1/users",
		`{"email":"budi@example.test","display_name":"Budi","role":"staff"}`, a.admin)
	if resp.StatusCode != 201 || body["account"] != "existing" || body["temporary_password"] != nil {
		t.Errorf("akun GONSU yang sudah ada = %d %v", resp.StatusCode, body)
	}
}

// Penolakan GONSU diterjemahkan ke katalog produk, dan tidak ada pengguna
// yang tercipta dari permintaan yang ditolak.
func TestInviteMapsGonsuRejections(t *testing.T) {
	f := newFakeIdentities(t)
	a := newUsersApp(t, agentAt(f))
	tests := []struct {
		gonsu  int
		status int
		code   string
	}{
		{429, 429, apperr.CodeRateLimited},
		{401, 502, apperr.CodeControlPlaneRejected},
		{403, 502, apperr.CodeControlPlaneRejected},
		{503, 503, apperr.CodeControlPlaneDown},
		{400, 400, apperr.CodeValidationFailed},
	}
	for _, tt := range tests {
		f.status.Store(int32(tt.gonsu))
		resp, body := a.call(t, http.MethodPost, "/v1/users",
			`{"email":"x@example.test","display_name":"X","role":"viewer"}`, a.admin)
		if resp.StatusCode != tt.status || errCode(body) != tt.code {
			t.Errorf("GONSU %d → %d %s, want %d %s", tt.gonsu, resp.StatusCode, errCode(body), tt.status, tt.code)
		}
	}
	if n := countRows(t, a.pool, `SELECT count(*) FROM application_users WHERE external_subject = 'usr_x'`); n != 0 {
		t.Errorf("pengguna tercipta dari penolakan: %d", n)
	}
	f.srv.Close()
	f.status.Store(0)
	resp, body := a.call(t, http.MethodPost, "/v1/users", `{"email":"y@example.test","display_name":"Y","role":"viewer"}`, a.admin)
	if resp.StatusCode != 503 || errCode(body) != apperr.CodeControlPlaneDown {
		t.Errorf("GONSU tak terjangkau = %d %v", resp.StatusCode, body)
	}
}

// Tanpa agent dan tanpa token, layar mengatakannya — GONSU tidak dipanggil.
func TestInviteUnavailableWithoutIdentityPath(t *testing.T) {
	a := newUsersApp(t, config.Config{})
	_, list := a.call(t, http.MethodGet, "/v1/users", "", a.admin)
	invite, _ := list["invite"].(map[string]any)
	if invite["available"] != false || invite["reason"] == "" {
		t.Errorf("invite = %v", invite)
	}
	resp, body := a.call(t, http.MethodPost, "/v1/users", `{"email":"x@example.test","display_name":"X","role":"viewer"}`, a.admin)
	if resp.StatusCode != 422 || errCode(body) != apperr.CodeIdentityUnavailable {
		t.Errorf("tanpa jalan pemberian akses = %d %v", resp.StatusCode, body)
	}
}

// Cloud: token sempit di Secret dikirim sebagai Bearer ke
// /license/v1/identities.
func TestInviteCloudPathSendsIdentityToken(t *testing.T) {
	f := newFakeIdentities(t)
	a := newUsersApp(t, config.Config{Getenv: env(map[string]string{
		"GONSU_BASE_URL": f.srv.URL, "GONSU_IDENTITY_TOKEN": "gid_pemasangan_ini",
	})})
	resp, _ := a.call(t, http.MethodPost, "/v1/users", `{"email":"awan@example.test","display_name":"Awan","role":"viewer"}`, a.admin)
	if resp.StatusCode != 201 || f.auth.Load() != "Bearer gid_pemasangan_ini" || f.path.Load() != "/license/v1/identities" {
		t.Errorf("status %d, auth %v, path %v", resp.StatusCode, f.auth.Load(), f.path.Load())
	}
}

func TestUserAdminGuards(t *testing.T) {
	f := newFakeIdentities(t)
	a := newUsersApp(t, agentAt(f))
	adminID := a.p.UserID.String()

	// Hanya pemegang settings.users.manage.
	_, ops := testdb.User(t, a.pool, a.p.OrganizationID, authz.RoleStaff)
	opsCookie := sessionFor(t, a.pool, ops, time.Hour)
	for _, c := range []struct{ method, path, body string }{
		{http.MethodGet, "/v1/users", ""},
		{http.MethodPost, "/v1/users", `{"email":"a@b.test","display_name":"A","role":"viewer"}`},
		{http.MethodPatch, "/v1/users/" + adminID, `{"role":"viewer"}`},
	} {
		if resp, body := a.call(t, c.method, c.path, c.body, opsCookie); resp.StatusCode != 403 || errCode(body) != apperr.CodePermissionDenied {
			t.Errorf("%s %s oleh operational_manager = %d", c.method, c.path, resp.StatusCode)
		}
	}
	if f.calls.Load() != 0 {
		t.Error("GONSU dipanggil untuk pengguna tanpa izin")
	}

	// Tidak dapat menonaktifkan diri sendiri; administrator terakhir tidak
	// dapat diturunkan.
	if resp, _ := a.call(t, http.MethodPatch, "/v1/users/"+adminID, `{"status":"SUSPENDED"}`, a.admin); resp.StatusCode != 400 {
		t.Errorf("menonaktifkan diri sendiri = %d", resp.StatusCode)
	}
	if resp, _ := a.call(t, http.MethodPatch, "/v1/users/"+adminID, `{"role":"viewer"}`, a.admin); resp.StatusCode != 400 {
		t.Errorf("menurunkan administrator terakhir = %d", resp.StatusCode)
	}
	// customer_viewer butuh scope customer: belum dapat diberikan dari layar.
	if resp, _ := a.call(t, http.MethodPost, "/v1/users", `{"email":"c@b.test","display_name":"C","role":"customer_viewer"}`, a.admin); resp.StatusCode != 400 {
		t.Errorf("customer_viewer dari layar = %d", resp.StatusCode)
	}

	// Ubah role, nonaktifkan (sesinya ikut mati), aktifkan kembali.
	_, body := a.call(t, http.MethodPost, "/v1/users", `{"email":"rina@example.test","display_name":"Rina","role":"viewer"}`, a.admin)
	rina := body["user"].(map[string]any)["id"].(string)
	var rinaP authn.Principal
	if err := a.pool.QueryRow(context.Background(), `SELECT id, organization_id FROM application_users WHERE id = $1`, rina).
		Scan(&rinaP.UserID, &rinaP.OrganizationID); err != nil {
		t.Fatal(err)
	}
	rinaCookie := sessionFor(t, a.pool, rinaP, time.Hour)
	if resp, _ := a.call(t, http.MethodGet, "/v1/me", "", rinaCookie); resp.StatusCode != 200 {
		t.Fatalf("sesi Rina = %d", resp.StatusCode)
	}
	if resp, body := a.call(t, http.MethodPatch, "/v1/users/"+rina, `{"role":"staff"}`, a.admin); resp.StatusCode != 200 || body["role"] != "staff" {
		t.Errorf("ubah role = %d %v", resp.StatusCode, body)
	}
	if resp, body := a.call(t, http.MethodPatch, "/v1/users/"+rina, `{"status":"SUSPENDED"}`, a.admin); resp.StatusCode != 200 || body["status"] != "SUSPENDED" {
		t.Errorf("nonaktifkan = %d %v", resp.StatusCode, body)
	}
	if resp, _ := a.call(t, http.MethodGet, "/v1/me", "", rinaCookie); resp.StatusCode != 401 {
		t.Errorf("sesi pengguna yang dinonaktifkan = %d, want 401", resp.StatusCode)
	}
	if resp, body := a.call(t, http.MethodPatch, "/v1/users/"+rina, `{"status":"ACTIVE"}`, a.admin); resp.StatusCode != 200 || body["status"] != "ACTIVE" {
		t.Errorf("aktifkan kembali = %d %v", resp.StatusCode, body)
	}
	var actions []string
	rows, err := a.pool.Query(context.Background(), `SELECT action FROM user_access_events WHERE application_user_id = $1 ORDER BY occurred_at, id`, rina)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var s string
		_ = rows.Scan(&s)
		actions = append(actions, s)
	}
	if got := strings.Join(actions, ","); got != "GRANTED,ROLE_CHANGED,SUSPENDED,REACTIVATED" {
		t.Errorf("riwayat akses Rina = %s", got)
	}

	// Dengan administrator kedua, yang pertama boleh diturunkan.
	if resp, _ := a.call(t, http.MethodPatch, "/v1/users/"+rina, `{"role":"administrator"}`, a.admin); resp.StatusCode != 200 {
		t.Fatalf("angkat administrator kedua = %d", resp.StatusCode)
	}
	if resp, body := a.call(t, http.MethodPatch, "/v1/users/"+adminID, `{"role":"staff"}`, a.admin); resp.StatusCode != 200 || body["role"] != "staff" {
		t.Errorf("turunkan administrator bukan-terakhir = %d %v", resp.StatusCode, body)
	}

	// Pengguna organization lain dijawab tidak ditemukan.
	_, other := testdb.Tenant(t, a.pool, authz.RoleViewer)
	if resp, _ := a.call(t, http.MethodPatch, "/v1/users/"+other.UserID.String(), `{"role":"viewer"}`, sessionFor(t, a.pool, rinaP, time.Hour)); resp.StatusCode != 404 {
		t.Errorf("pengguna organization lain = %d, want 404", resp.StatusCode)
	}
}

// users.max diperiksa SEBELUM GONSU membuat akun: akun yang tidak dapat
// diberi akses hanya menghabiskan kuota identitas harian pemasangan.
func TestInviteRespectsUsersMax(t *testing.T) {
	f := newFakeIdentities(t)
	f.license.Store(`{"allowed":true,"state":"active","granted":true,"entitlements":{"produk-contoh.core":true,"users.max":2}}`)
	a := newUsersApp(t, agentAt(f))

	if resp, _ := a.call(t, http.MethodPost, "/v1/users", `{"email":"satu@example.test","display_name":"Satu","role":"viewer"}`, a.admin); resp.StatusCode != 201 {
		t.Fatalf("pengguna kedua = %d", resp.StatusCode)
	}
	calls := f.calls.Load()
	resp, body := a.call(t, http.MethodPost, "/v1/users", `{"email":"dua@example.test","display_name":"Dua","role":"viewer"}`, a.admin)
	e, _ := body["error"].(map[string]any)
	if resp.StatusCode != 403 || errCode(body) != apperr.CodeEntitlementRequired || e["required_entitlement"] != "users.max" {
		t.Errorf("melewati users.max = %d %v", resp.StatusCode, body)
	}
	if f.calls.Load() != calls {
		t.Error("GONSU dipanggil walau kuota penuh")
	}
	_, list := a.call(t, http.MethodGet, "/v1/users", "", a.admin)
	if seats := list["seats"].(map[string]any); seats["active"] != float64(2) || seats["max"] != float64(2) {
		t.Errorf("seats = %v", seats)
	}
}
