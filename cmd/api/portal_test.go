package main

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authn"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authz"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/config"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/entitlement"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/testdb"
)

// Tautan Portal (langganan, tagihan, paket) hanya bagi yang mengurus
// langganan, dan tujuannya disusun kit dari alamat Portal milik GONSU.
func TestPortalLinksAreGuarded(t *testing.T) {
	pool := testdb.New(t)
	app := newAppWith(t, pool, config.Config{Getenv: env(map[string]string{
		"GONSU_PORTAL_URL": "https://portal.gonsu.example", "GONSU_ORGANIZATION_ID": "org_test",
	})})
	_, admin := testdb.Tenant(t, pool, authz.RoleAdministrator)
	viewerCtx, _ := testdb.User(t, pool, admin.OrganizationID, authz.RoleViewer)
	viewer, _ := authn.PrincipalFrom(viewerCtx)

	// Tanpa sesi: ke halaman masuk, lalu kembali ke tautan yang sama.
	resp := do(t, app, call{method: http.MethodGet, path: "/auth/gonsu/portal/subscription"})
	if want := "/auth/login?next=%2Fauth%2Fgonsu%2Fportal%2Fsubscription"; resp.StatusCode != http.StatusSeeOther || resp.Header.Get("Location") != want {
		t.Errorf("tanpa sesi: %d %q, ingin 303 %q", resp.StatusCode, resp.Header.Get("Location"), want)
	}

	// Viewer tidak mengurus langganan.
	resp = do(t, app, call{method: http.MethodGet, path: "/auth/gonsu/portal/invoices", cookie: sessionFor(t, pool, viewer, time.Hour)})
	if resp.StatusCode != http.StatusForbidden || errorCode(t, resp) != apperr.CodePermissionDenied {
		t.Errorf("viewer: %d, ingin 403 PERMISSION_DENIED", resp.StatusCode)
	}

	// Administrator diantar ke paket produk ini di bisnisnya.
	cookie := sessionFor(t, pool, admin, time.Hour)
	resp = do(t, app, call{method: http.MethodGet, path: "/auth/gonsu/portal/plans", cookie: cookie})
	want := "https://portal.gonsu.example/organizations/org_test/catalog/" + entitlement.ProductCode
	if resp.StatusCode != http.StatusSeeOther || resp.Header.Get("Location") != want {
		t.Errorf("administrator: %d %q, ingin 303 %q", resp.StatusCode, resp.Header.Get("Location"), want)
	}

	if !mePortal(t, app, cookie) {
		t.Error("/v1/me menyebut portal false padahal GONSU_PORTAL_URL terisi")
	}
}

// Tanpa alamat Portal: layar tidak menampilkan tautannya, dan jalurnya 404.
func TestPortalLinksWithoutPortalURL(t *testing.T) {
	pool := testdb.New(t)
	app := newApp(t, pool)
	_, admin := testdb.Tenant(t, pool, authz.RoleAdministrator)
	cookie := sessionFor(t, pool, admin, time.Hour)

	if mePortal(t, app, cookie) {
		t.Error("/v1/me menyebut portal true tanpa GONSU_PORTAL_URL")
	}
	resp := do(t, app, call{method: http.MethodGet, path: "/auth/gonsu/portal/subscription", cookie: cookie})
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("status %d, ingin 404", resp.StatusCode)
	}
}

func mePortal(t *testing.T, app http.Handler, cookie *http.Cookie) bool {
	t.Helper()
	resp := do(t, app, call{method: http.MethodGet, path: "/v1/me", cookie: cookie})
	var me struct {
		Portal bool `json:"portal"`
	}
	if resp.StatusCode != http.StatusOK || json.NewDecoder(resp.Body).Decode(&me) != nil {
		t.Fatalf("/v1/me: %d", resp.StatusCode)
	}
	return me.Portal
}
