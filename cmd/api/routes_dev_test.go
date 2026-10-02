//go:build dev

package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authn"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/testdb"
)

func TestDevLoginIssuesSessionForChosenRole(t *testing.T) {
	pool := testdb.New(t)
	app := newApp(t, pool)

	login := func(query string) *http.Cookie {
		t.Helper()
		resp := do(t, app, call{method: http.MethodGet, path: "/auth/login" + query})
		if resp.StatusCode != http.StatusSeeOther || !strings.HasPrefix(resp.Header.Get("Location"), "/") {
			t.Fatalf("login%s = %d → %q", query, resp.StatusCode, resp.Header.Get("Location"))
		}
		for _, c := range resp.Cookies() {
			if c.Name == authn.CookieName {
				if !c.HttpOnly || !c.Secure || c.SameSite != http.SameSiteLaxMode {
					t.Errorf("cookie sesi tidak HttpOnly/Secure/Lax: %+v", c)
				}
				return c
			}
		}
		t.Fatal("tidak ada cookie sesi")
		return nil
	}
	role := func(c *http.Cookie) string {
		t.Helper()
		resp := do(t, app, call{method: http.MethodGet, path: "/v1/me", cookie: c})
		var me struct{ Role string }
		if err := json.NewDecoder(resp.Body).Decode(&me); err != nil {
			t.Fatal(err)
		}
		return me.Role
	}

	if got := role(login("")); got != "administrator" {
		t.Errorf("role bawaan = %q", got)
	}
	if got := role(login("?as=viewer")); got != "viewer" {
		t.Errorf("role ?as=viewer = %q", got)
	}
	if resp := do(t, app, call{method: http.MethodGet, path: "/auth/login?as=root"}); resp.StatusCode != http.StatusBadRequest {
		t.Errorf("role tak dikenal = %d, want 400", resp.StatusCode)
	}

	// `sub` yang tidak pernah diberi akses ditolak dengan
	// pesan yang membedakannya dari gagal login — tanpa sesi.
	resp := do(t, app, call{method: http.MethodGet, path: "/auth/login?sub=usr_tidak_dikenal"})
	if resp.StatusCode != http.StatusSeeOther || resp.Header.Get("Location") != "/sign-in/?error=not-granted" ||
		len(resp.Cookies()) != 0 {
		t.Errorf("sub tak dikenal = %d → %q, cookie %v", resp.StatusCode, resp.Header.Get("Location"), resp.Cookies())
	}
	// Yang sudah diberi akses (di sini: pengguna ?as=viewer di atas) masuk.
	if got := role(login("?sub=dev:viewer")); got != "viewer" {
		t.Errorf("role ?sub=dev:viewer = %q", got)
	}

	// Sesi pengembangan dapat memakai API bisnis seperti sesi sungguhan.
	resp = do(t, app, call{method: http.MethodGet, path: "/v1/notes", cookie: login("")})
	if resp.StatusCode != http.StatusOK {
		t.Errorf("GET /v1/notes dengan sesi pengembangan = %d", resp.StatusCode)
	}
}
