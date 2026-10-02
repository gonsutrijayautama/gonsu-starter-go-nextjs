//go:build !dev

package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gonsutrijayautama/gonsu-one-sdk-go/web"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authn"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authz"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/testdb"
)

// Build rilis TIDAK memuat login pengembangan — dibuktikan,
// bukan diasumsikan. /auth/login selalu menuju GONSU dan tidak pernah
// menerbitkan sesi; tanpa konfigurasi login GONSU, GONSU-nya mengarah ke
// halaman yang menyebut sebabnya.
func TestReleaseBuildHasNoDevLogin(t *testing.T) {
	if authn.DevLoginEnabled() {
		t.Fatal("binary rilis membawa login pengembangan")
	}
	h := newApp(t, testdb.New(t))

	for _, path := range []string{"/auth/login", "/auth/login?as=administrator", "/auth/login?sub=dev:administrator"} {
		resp := do(t, h, call{method: http.MethodGet, path: path})
		if resp.StatusCode != http.StatusSeeOther || resp.Header.Get("Location") != web.LoginPath {
			t.Errorf("GET %s = %d → %q", path, resp.StatusCode, resp.Header.Get("Location"))
		}
		if len(resp.Cookies()) != 0 {
			t.Errorf("GET %s menerbitkan cookie: %v", path, resp.Cookies())
		}
	}
	resp := do(t, h, call{method: http.MethodGet, path: web.LoginPath})
	if resp.StatusCode != http.StatusSeeOther || resp.Header.Get("Location") != "/sign-in/?error=not-configured" ||
		len(resp.Cookies()) != 0 {
		t.Errorf("GET %s = %d → %q, cookie %v", web.LoginPath, resp.StatusCode, resp.Header.Get("Location"), resp.Cookies())
	}
}

// Sesi login pengembangan yang tertinggal di database tidak berlaku pada
// binary rilis.
func TestReleaseBuildRejectsDevSessions(t *testing.T) {
	pool := testdb.New(t)
	h := newApp(t, pool)
	_, p := testdb.Tenant(t, pool, authz.RoleAdministrator)

	rec := httptest.NewRecorder()
	if err := authn.NewSessions(pool, nil, 0, quiet).Issue(context.Background(), rec, authn.NewSession{
		UserID: p.UserID, OrganizationID: p.OrganizationID, Kind: authn.KindDev, TTL: time.Hour,
	}); err != nil {
		t.Fatal(err)
	}
	resp := do(t, h, call{method: http.MethodGet, path: "/v1/me", cookie: rec.Result().Cookies()[0]})
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("sesi DEV pada binary rilis = %d, want 401", resp.StatusCode)
	}
}
