package authn

import (
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gonsutrijayautama/gonsu-one-sdk-go/web"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authn/store"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authz"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/httpx"
)

// LoginDeps adalah kebutuhan route login. /auth/login dipasang build tag:
// devlogin.go (build `dev`) atau login_release.go (binary rilis); sisanya
// sama untuk keduanya.
type LoginDeps struct {
	Pool     *pgxpool.Pool
	Sessions *Sessions
	// Kit melayani jalur login milik GONSU di bawah /auth/gonsu/.
	Kit *web.Kit
	// GonsuLogin: GONSU memberi pemasangan ini login. Hanya build dev yang
	// membacanya, untuk memilih antara GONSU dan login pengembangan di
	// /auth/login.
	GonsuLogin bool
	// Organization adalah organization pemasangan (tenant.EnsureInstallation).
	Organization uuid.UUID
	Logger       *slog.Logger
	// Limits dan TrustedProxies membatasi laju pada jalur BALIKAN login —
	// satu-satunya jalur di sini yang memproses kredensial. Nil berarti tanpa
	// pembatas (dipakai tes).
	Limits         *httpx.Limits
	TrustedProxies httpx.TrustedProxies
}

// DevLoginEnabled melaporkan apakah binary ini membawa login pengembangan.
// Selalu false pada build rilis — kodenya bahkan tidak ter-compile.
func DevLoginEnabled() bool { return devLoginEnabled }

// landing adalah halaman pendaratan sesudah login bila tidak ada `next`.
const landing = "/dashboard/"

// returnTo memilih ke mana orang dikembalikan sesudah login: `next` bila ada —
// itulah yang membuat tautan ke halaman detail tetap berfungsi sesudah sesi
// habis — atau halaman pendaratan. `next` sudah disaring localPath.
func returnTo(next string) string {
	if next == "" {
		return landing
	}
	return next
}

// Sebab login gagal, sebagai ?error= di halaman /sign-in/. Pesannya disusun
// halaman itu; server hanya menyebut sebabnya.
const (
	failNotGranted    = "not-granted"
	failExpired       = "expired"
	failUnreachable   = "unreachable"
	failNotConfigured = "not-configured"
	failRejected      = "rejected"
)

// failCodes menerjemahkan sebab dari kit ke ?error= halaman /sign-in/.
var failCodes = map[web.Reason]string{
	web.ReasonNotGranted:    failNotGranted,
	web.ReasonExpired:       failExpired,
	web.ReasonUnreachable:   failUnreachable,
	web.ReasonNotConfigured: failNotConfigured,
	web.ReasonRejected:      failRejected,
}

// limitLogin mengembalikan middleware pembatas untuk jalur balikan, atau
// middleware kosong bila pembatasnya tidak dipasang.
func (d LoginDeps) limitLogin() func(http.Handler) http.Handler {
	if d.Limits == nil {
		return func(next http.Handler) http.Handler { return next }
	}
	return httpx.Limit(d.Limits.Login, httpx.ClientIP(d.TrustedProxies),
		"Terlalu banyak percobaan masuk dari jaringan ini. Tunggu sebentar lalu coba lagi.")
}

func fail(w http.ResponseWriter, r *http.Request, reason string) {
	http.Redirect(w, r, "/sign-in/?error="+reason, http.StatusSeeOther)
}

// mountCommon memasang route login yang sama di build rilis dan dev.
func (d LoginDeps) mountCommon(r chi.Router) {
	// Jalur milik GONSU — masuk, balikan, "Akun saya", lupa sandi, ganti
	// akun — dilayani kit apa adanya. Dipasang di sini, bukan di MountLogin
	// per-build: jalur itu harus berperilaku sama di build dev maupun rilis,
	// dan tidak boleh ikut cabang `?as=<role>` login pengembangan.
	gonsu := d.Kit.Handler()
	r.Handle("/auth/gonsu/*", gonsu)
	// HANYA balikan yang dibatasi, bukan seluruh /auth.
	//
	// Jalur lain di sini tidak memproses kredensial: jalur masuk hanya
	// mengarahkan ke GONSU, `/auth/logout` mengakhiri sesi yang sudah ada, dan
	// sisanya tautan ke halaman GONSU. Membatasi semuanya bersama-sama berarti
	// orang yang keluar lalu masuk lagi menghabiskan jatah yang seharusnya
	// menjaga verifikasi token — dan pada pemasangan di belakang proxy, jatah
	// itu dipakai bersama seluruh kantor.
	r.With(d.limitLogin()).Method(http.MethodGet, web.CallbackPath, gonsu)
	r.With(httpx.CrossOrigin()).Post("/auth/logout", d.logout)
	// Tautan ke Portal GONSU — langganan, tagihan, paket — hanya bagi yang
	// mengurus langganan. Jalurnya dibuka dari tautan, bukan dipanggil fetch:
	// tanpa sesi diarahkan ke login, bukan menerima envelope JSON.
	r.With(d.Sessions.Middleware(PageLogin()), requirePermission(authz.SettingsSubscriptionView, d.Logger)).
		Handle("/auth/gonsu/portal/*", gonsu)
}

// startGonsu: /auth/login milik produk menuju jalur masuk milik GONSU,
// membawa `next` bila menunjuk halaman di aplikasi ini.
func startGonsu(w http.ResponseWriter, r *http.Request) {
	target := web.LoginPath
	if next := localPath(r.URL.Query().Get("next")); next != "" {
		target += "?next=" + url.QueryEscape(next)
	}
	http.Redirect(w, r, target, http.StatusSeeOther)
}

// logout mematikan sesi produk, lalu — untuk sesi GONSU — mengakhiri sesi di
// penyedia identitas juga. Keduanya terpisah dengan sengaja.
func (d LoginDeps) logout(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	http.SetCookie(w, &http.Cookie{Name: CookieName, Path: "/", MaxAge: -1,
		HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode})

	c, err := r.Cookie(CookieName)
	if err != nil || c.Value == "" {
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}
	row, err := store.New(d.Pool).RevokeSessionByToken(ctx, hashToken(c.Value))
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		httpx.WriteError(w, r, d.Logger, err)
		return
	}
	if err == nil && Kind(row.AuthKind) == KindGonsu && row.IDToken != nil {
		if u, err := d.Kit.LogoutURL(ctx, *row.IDToken); err == nil && u != "" {
			http.Redirect(w, r, u, http.StatusSeeOther)
			return
		}
	}
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

// localPath menerima hanya path di aplikasi ini: "/notes/", bukan
// "//penyerang.test" atau "https://…" — open redirect sesudah login.
func localPath(p string) string {
	if !strings.HasPrefix(p, "/") || strings.HasPrefix(p, "//") || strings.ContainsAny(p, "\\\r\n") {
		return ""
	}
	u, err := url.Parse(p)
	if err != nil || u.Scheme != "" || u.Host != "" {
		return ""
	}
	return p
}

func nonEmpty(s string) *string {
	if s = strings.TrimSpace(s); s == "" {
		return nil
	}
	return &s
}
