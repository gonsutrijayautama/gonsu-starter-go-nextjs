package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authn"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authz"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/config"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/httpx"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/testdb"
)

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

func newApp(t *testing.T, pool *pgxpool.Pool) http.Handler {
	t.Helper()
	return newAppWith(t, pool, config.Config{})
}

func newAppWith(t *testing.T, pool *pgxpool.Pool, cfg config.Config) http.Handler {
	t.Helper()
	a, err := prepare(context.Background(), pool, cfg, quiet)
	if err != nil {
		t.Fatal(err)
	}
	return serve(t, a)
}

func serve(t *testing.T, a app) http.Handler {
	t.Helper()
	routes, err := a.routes()
	if err != nil {
		t.Fatal(err)
	}
	return httpx.NewRouter(httpx.Options{Version: "test", Frontend: fstest.MapFS{}, Logger: quiet, Routes: routes})
}

// sessionFor menerbitkan sesi GONSU yang baru saja diperiksa — bentuk sesi
// yang diterima build rilis maupun dev.
func sessionFor(t *testing.T, pool *pgxpool.Pool, p authn.Principal, ttl time.Duration) *http.Cookie {
	t.Helper()
	rec := httptest.NewRecorder()
	if err := authn.NewSessions(pool, nil, 0, quiet).Issue(context.Background(), rec, authn.NewSession{
		UserID: p.UserID, OrganizationID: p.OrganizationID, Kind: authn.KindGonsu, TTL: ttl,
		RefreshToken: "refresh-test", IDToken: "id-test",
	}); err != nil {
		t.Fatal(err)
	}
	return rec.Result().Cookies()[0]
}

type call struct {
	method, path, body string
	cookie             *http.Cookie
	header             map[string]string
}

func do(t *testing.T, app http.Handler, c call) *http.Response {
	t.Helper()
	req := httptest.NewRequest(c.method, c.path, strings.NewReader(c.body))
	// Browser mengirim ini untuk fetch dari halaman aplikasi sendiri.
	req.Header.Set("Sec-Fetch-Site", "same-origin")
	if c.body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range c.header {
		req.Header.Set(k, v)
	}
	if c.cookie != nil {
		req.AddCookie(c.cookie)
	}
	rec := httptest.NewRecorder()
	app.ServeHTTP(rec, req)
	return rec.Result()
}

func errorCode(t *testing.T, resp *http.Response) string {
	t.Helper()
	var env struct {
		Error struct{ Code string } `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		t.Fatalf("response bukan envelope galat: %v", err)
	}
	return env.Error.Code
}

const noteBody = `{"title": "Rapat Senin", "body": "Bahas target bulan depan."}`

// Tidak ada API bisnis tanpa identitas.
func TestAPIRequiresSession(t *testing.T) {
	pool := testdb.New(t)
	app := newApp(t, pool)
	for _, path := range []string{"/v1/notes", "/v1/me", "/v1/users", "/v1/missing"} {
		resp := do(t, app, call{method: http.MethodGet, path: path})
		if resp.StatusCode != http.StatusUnauthorized || errorCode(t, resp) != apperr.CodeUnauthenticated {
			t.Errorf("GET %s tanpa sesi = %d", path, resp.StatusCode)
		}
	}
}

func TestExpiredOrSuspendedSessionIsRejected(t *testing.T) {
	pool := testdb.New(t)
	app := newApp(t, pool)
	_, p := testdb.Tenant(t, pool, authz.RoleStaff)

	expired := sessionFor(t, pool, p, -time.Minute)
	if resp := do(t, app, call{method: http.MethodGet, path: "/v1/me", cookie: expired}); resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("sesi kedaluwarsa = %d, want 401", resp.StatusCode)
	}

	valid := sessionFor(t, pool, p, time.Hour)
	if resp := do(t, app, call{method: http.MethodGet, path: "/v1/me", cookie: valid}); resp.StatusCode != http.StatusOK {
		t.Fatalf("sesi sah = %d", resp.StatusCode)
	}
	// Pengguna yang di-suspend kehilangan akses pada request berikutnya,
	// bukan saat sesinya habis.
	if _, err := pool.Exec(context.Background(), "UPDATE application_users SET status = 'SUSPENDED' WHERE id = $1", p.UserID); err != nil {
		t.Fatal(err)
	}
	if resp := do(t, app, call{method: http.MethodGet, path: "/v1/me", cookie: valid}); resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("pengguna di-suspend = %d, want 401", resp.StatusCode)
	}
}

// Pembuatan data lewat HTTP idempotent: permintaan yang diulang dengan kunci
// yang sama diputar ulang byte per byte, tanpa catatan ganda.
func TestCreateNoteOverHTTP(t *testing.T) {
	pool := testdb.New(t)
	app := newApp(t, pool)
	_, p := testdb.Tenant(t, pool, authz.RoleStaff)
	cookie := sessionFor(t, pool, p, time.Hour)
	create := call{method: http.MethodPost, path: "/v1/notes", body: noteBody, cookie: cookie,
		header: map[string]string{"Idempotency-Key": "http-note-0001"}}

	first := do(t, app, create)
	if first.StatusCode != http.StatusCreated {
		t.Fatalf("POST /v1/notes = %d", first.StatusCode)
	}
	firstBody, _ := io.ReadAll(first.Body)
	var n struct {
		ID    string `json:"id"`
		Title string `json:"title"`
	}
	if err := json.Unmarshal(firstBody, &n); err != nil || n.Title != "Rapat Senin" {
		t.Fatalf("catatan = %s, %v", firstBody, err)
	}

	again := do(t, app, create)
	againBody, _ := io.ReadAll(again.Body)
	if again.StatusCode != http.StatusCreated || again.Header.Get("Idempotent-Replayed") != "true" ||
		!bytes.Equal(firstBody, againBody) {
		t.Errorf("retry: status %d, replayed %q, body sama %v",
			again.StatusCode, again.Header.Get("Idempotent-Replayed"), bytes.Equal(firstBody, againBody))
	}
	if n := countRows(t, pool, "SELECT count(*) FROM notes"); n != 1 {
		t.Errorf("catatan tersimpan = %d, ingin 1", n)
	}

	if got := do(t, app, call{method: http.MethodGet, path: "/v1/notes/" + n.ID, cookie: cookie}); got.StatusCode != http.StatusOK {
		t.Errorf("GET catatan = %d", got.StatusCode)
	}
	if bad := do(t, app, call{method: http.MethodGet, path: "/v1/notes/not-a-uuid", cookie: cookie}); bad.StatusCode != http.StatusNotFound {
		t.Errorf("GET id rusak = %d, want 404", bad.StatusCode)
	}
}

func TestCreateNoteGuards(t *testing.T) {
	pool := testdb.New(t)
	app := newApp(t, pool)
	_, p := testdb.Tenant(t, pool, authz.RoleStaff)
	cookie := sessionFor(t, pool, p, time.Hour)
	key := map[string]string{"Idempotency-Key": "http-note-guard"}

	tests := []struct {
		name   string
		c      call
		status int
		code   string
	}{
		{"tanpa Idempotency-Key", call{method: http.MethodPost, path: "/v1/notes", body: noteBody, cookie: cookie},
			http.StatusBadRequest, apperr.CodeValidationFailed},
		{"mutasi lintas origin (CSRF)", call{method: http.MethodPost, path: "/v1/notes", body: noteBody, cookie: cookie,
			header: map[string]string{"Idempotency-Key": "http-note-csrf", "Sec-Fetch-Site": "cross-site"}},
			http.StatusForbidden, apperr.CodePermissionDenied},
		// organization_id palsu di body tidak boleh diterima: field yang
		// tidak dikenal ditolak, dan scope hanya datang dari sesi.
		{"organization_id dari body", call{method: http.MethodPost, path: "/v1/notes", cookie: cookie, header: key,
			body: strings.Replace(noteBody, "{", `{"organization_id": "00000000-0000-0000-0000-000000000000",`, 1)},
			http.StatusBadRequest, apperr.CodeValidationFailed},
		{"body bukan JSON", call{method: http.MethodPost, path: "/v1/notes", body: "bukan json", cookie: cookie, header: key},
			http.StatusBadRequest, apperr.CodeValidationFailed},
		{"judul kosong", call{method: http.MethodPost, path: "/v1/notes", body: `{"title": "  "}`, cookie: cookie, header: key},
			http.StatusBadRequest, apperr.CodeValidationFailed},
		{"path API tak dikenal", call{method: http.MethodGet, path: "/v1/missing", cookie: cookie},
			http.StatusNotFound, apperr.CodeResourceNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := do(t, app, tt.c)
			if resp.StatusCode != tt.status || errorCode(t, resp) != tt.code {
				t.Errorf("status = %d, want %d %s", resp.StatusCode, tt.status, tt.code)
			}
		})
	}

	// Viewer boleh membaca, tidak boleh menulis.
	viewer, _ := testdb.User(t, pool, p.OrganizationID, authz.RoleViewer)
	vp, _ := authn.PrincipalFrom(viewer)
	vc := sessionFor(t, pool, vp, time.Hour)
	if resp := do(t, app, call{method: http.MethodGet, path: "/v1/notes", cookie: vc}); resp.StatusCode != http.StatusOK {
		t.Errorf("viewer membaca catatan = %d", resp.StatusCode)
	}
	resp := do(t, app, call{method: http.MethodPost, path: "/v1/notes", body: noteBody, cookie: vc, header: key})
	if resp.StatusCode != http.StatusForbidden || errorCode(t, resp) != apperr.CodePermissionDenied {
		t.Errorf("viewer membuat catatan = %d", resp.StatusCode)
	}
}

// Catatan pemasangan lain tidak terlihat dan tidak dapat diubah — dijawab
// "tidak ditemukan", bukan "ditolak", supaya keberadaannya tidak bocor.
func TestNotesAreTenantScoped(t *testing.T) {
	pool := testdb.New(t)
	app := newApp(t, pool)
	_, a := testdb.Tenant(t, pool, authz.RoleStaff)
	_, b := testdb.Tenant(t, pool, authz.RoleStaff)
	ca, cb := sessionFor(t, pool, a, time.Hour), sessionFor(t, pool, b, time.Hour)

	resp := do(t, app, call{method: http.MethodPost, path: "/v1/notes", body: noteBody, cookie: ca,
		header: map[string]string{"Idempotency-Key": "tenant-note-a"}})
	var n struct{ ID string }
	if err := json.NewDecoder(resp.Body).Decode(&n); err != nil || n.ID == "" {
		t.Fatalf("membuat catatan A: %d %v", resp.StatusCode, err)
	}
	for _, c := range []call{
		{method: http.MethodGet, path: "/v1/notes/" + n.ID, cookie: cb},
		{method: http.MethodPut, path: "/v1/notes/" + n.ID, body: noteBody, cookie: cb},
		{method: http.MethodDelete, path: "/v1/notes/" + n.ID, cookie: cb},
	} {
		if resp := do(t, app, c); resp.StatusCode != http.StatusNotFound {
			t.Errorf("%s oleh pemasangan lain = %d, want 404", c.method, resp.StatusCode)
		}
	}
	var list struct{ Data []any }
	_ = json.NewDecoder(do(t, app, call{method: http.MethodGet, path: "/v1/notes", cookie: cb}).Body).Decode(&list)
	if len(list.Data) != 0 {
		t.Errorf("daftar catatan pemasangan lain memuat %d baris", len(list.Data))
	}
}

// /v1/me membawa permission pengguna supaya UI tidak menyalin matriks izin.
func TestMeListsPermissions(t *testing.T) {
	pool := testdb.New(t)
	app := newApp(t, pool)
	_, p := testdb.Tenant(t, pool, authz.RoleViewer)
	resp := do(t, app, call{method: http.MethodGet, path: "/v1/me", cookie: sessionFor(t, pool, p, time.Hour)})
	var me struct {
		Permissions []string `json:"permissions"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&me); err != nil {
		t.Fatal(err)
	}
	joined := "," + strings.Join(me.Permissions, ",") + ","
	if !strings.Contains(joined, ",notes.read,") || strings.Contains(joined, ",notes.write,") {
		t.Errorf("permissions viewer = %v", me.Permissions)
	}
}
