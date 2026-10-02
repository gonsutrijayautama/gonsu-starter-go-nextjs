package authn_test

import (
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/gonsutrijayautama/gonsu-one-sdk-go/auth"
	"github.com/gonsutrijayautama/gonsu-one-sdk-go/web"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authn"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/entitlement"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/testdb"
)

// mountUnconfigured memasang route login dengan kit yang tidak diberi login
// GONSU sama sekali.
func mountUnconfigured(t *testing.T) http.Handler {
	t.Helper()
	pool := testdb.New(t)
	quiet := slog.New(slog.DiscardHandler)
	login := authn.NewGonsuLogin(pool, quiet)
	kit, err := web.New(web.Options{
		ProductCode: entitlement.ProductCode, Hooks: login.Hooks(), Logger: quiet,
		Pending: authn.NewLoginAttempts(pool), Getenv: func(string) string { return "" },
	})
	if err != nil {
		t.Fatal(err)
	}
	sessions := authn.NewSessions(pool, kit, 0, quiet)
	login.Bind(kit, uuid.New(), sessions)
	r := chi.NewRouter()
	authn.MountLogin(r, authn.LoginDeps{Pool: pool, Sessions: sessions, Kit: kit, Logger: quiet})
	return r
}

// `/auth/gonsu/login` adalah jalur masuk milik GONSU (kontrak kit web SDK
// GONSU). Tombol "Buka aplikasi" di Portal menunjuk ke sini, jadi alamatnya
// tidak boleh berubah dan tidak boleh hilang — termasuk pada build dev.
func TestGonsuLoginPathExists(t *testing.T) {
	r := mountUnconfigured(t)

	req := httptest.NewRequest(http.MethodGet, web.LoginPath, nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// Tanpa konfigurasi login GONSU: halaman produk yang menyebut sebabnya,
	// bukan 404 dan bukan sesi.
	if w.Code != http.StatusSeeOther {
		t.Fatalf("status = %d, ingin 303 — jalur ini wajib ada", w.Code)
	}
	if loc := w.Header().Get("Location"); loc != "/sign-in/?error=not-configured" {
		t.Errorf("tujuan = %q", loc)
	}
	// Ia tidak boleh menerbitkan sesi sendiri: yang menerbitkan sesi hanyalah
	// callback sesudah GONSU memverifikasi orangnya.
	if c := w.Header().Get("Set-Cookie"); c != "" {
		t.Errorf("jalur login menerbitkan cookie: %q", c)
	}
}

// Jalur milik GONSU tidak ikut cabang login pengembangan: `?as=<role>` di sini
// tidak boleh membuat sesi, sekalipun pada build dev.
func TestGonsuLoginPathIgnoresDevLogin(t *testing.T) {
	r := mountUnconfigured(t)

	req := httptest.NewRequest(http.MethodGet, web.LoginPath+"?as=administrator", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if c := w.Header().Get("Set-Cookie"); c != "" {
		t.Fatalf("jalur GONSU menerbitkan sesi pengembangan: %q", c)
	}
	if w.Code != http.StatusSeeOther {
		t.Errorf("status = %d, ingin 303", w.Code)
	}
}

// Percobaan login hanya dapat diambil sekali, dan tidak sesudah waktunya.
func TestLoginAttemptsAreSingleUse(t *testing.T) {
	ctx := context.Background()
	attempts := authn.NewLoginAttempts(testdb.New(t))
	login := web.PendingLogin{
		Auth: auth.Pending{State: "s", Nonce: "n", Verifier: "v"}, Next: "/notes/",
		ExpiresAt: time.Now().Add(time.Minute),
	}
	if err := attempts.Put(ctx, "kunci", login); err != nil {
		t.Fatal(err)
	}
	got, found, err := attempts.Take(ctx, "kunci")
	if err != nil || !found || got.Auth != login.Auth || got.Next != "/notes/" {
		t.Fatalf("Take = %+v, %v, %v", got, found, err)
	}
	if _, found, err := attempts.Take(ctx, "kunci"); err != nil || found {
		t.Errorf("diambil dua kali: found %v, err %v", found, err)
	}

	login.ExpiresAt = time.Now().Add(-time.Second)
	if err := attempts.Put(ctx, "lewat", login); err != nil {
		t.Fatal(err)
	}
	if _, found, err := attempts.Take(ctx, "lewat"); err != nil || found {
		t.Errorf("percobaan kedaluwarsa diterima: found %v, err %v", found, err)
	}
}
