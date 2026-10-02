package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gonsutrijayautama/gonsu-one-sdk-go/web"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authn"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authz"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/config"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/entitlement"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/testdb"
)

const (
	testClientID = "app-test"
	testRedirect = "https://app.example.test" + web.CallbackPath
	// attemptCookie adalah cookie percobaan login milik kit.
	attemptCookie = "gonsu_login"
)

// fakeIdP adalah penyedia identitas OIDC tiruan: discovery, JWKS, dan token
// endpoint dengan PKCE S256 serta refresh token yang dirotasi. Token
// ditandatangani ES256 dengan kunci yang dibuat test.
type fakeIdP struct {
	srv *httptest.Server
	key *ecdsa.PrivateKey

	mu            sync.Mutex
	codes         map[string]idpGrant
	refresh       map[string]bool
	refreshStatus int
	badNonce      bool
}

type idpGrant struct{ sub, email, nonce, challenge string }

func newFakeIdP(t *testing.T) *fakeIdP {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	f := &fakeIdP{key: key, codes: map[string]idpGrant{}, refresh: map[string]bool{}}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /.well-known/openid-configuration", func(w http.ResponseWriter, r *http.Request) {
		writeTestJSON(w, 200, map[string]any{
			"issuer":                                f.srv.URL,
			"authorization_endpoint":                f.srv.URL + "/authorize",
			"token_endpoint":                        f.srv.URL + "/token",
			"jwks_uri":                              f.srv.URL + "/jwks",
			"end_session_endpoint":                  f.srv.URL + "/logout",
			"id_token_signing_alg_values_supported": []string{"ES256"},
			"code_challenge_methods_supported":      []string{"S256"},
		})
	})
	mux.HandleFunc("GET /jwks", func(w http.ResponseWriter, r *http.Request) {
		pub, _ := key.PublicKey.ECDH()
		raw := pub.Bytes()
		writeTestJSON(w, 200, map[string]any{"keys": []map[string]string{{
			"kty": "EC", "crv": "P-256", "kid": "k1", "alg": "ES256", "use": "sig",
			"x": base64.RawURLEncoding.EncodeToString(raw[1:33]),
			"y": base64.RawURLEncoding.EncodeToString(raw[33:]),
		}}})
	})
	mux.HandleFunc("POST /token", f.token)
	f.srv = httptest.NewServer(mux)
	t.Cleanup(f.srv.Close)
	return f
}

// authorize memerankan browser yang login di GONSU sebagai sub: membaca
// alamat authorize yang disusun aplikasi, lalu menerbitkan code untuknya.
func (f *fakeIdP) authorize(t *testing.T, authorizeURL, sub string) (state, code string) {
	t.Helper()
	u, err := url.Parse(authorizeURL)
	if err != nil || !strings.HasPrefix(authorizeURL, f.srv.URL+"/authorize?") {
		t.Fatalf("alamat authorize = %q", authorizeURL)
	}
	q := u.Query()
	if q.Get("client_id") != testClientID || q.Get("redirect_uri") != testRedirect ||
		q.Get("code_challenge_method") != "S256" || q.Get("code_challenge") == "" ||
		!strings.Contains(q.Get("scope"), "offline_access") {
		t.Fatalf("parameter authorize = %v", q)
	}
	code = rand.Text()
	f.mu.Lock()
	f.codes[code] = idpGrant{sub: sub, email: sub + "@example.test", nonce: q.Get("nonce"), challenge: q.Get("code_challenge")}
	f.mu.Unlock()
	return q.Get("state"), code
}

func (f *fakeIdP) token(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()
	f.mu.Lock()
	defer f.mu.Unlock()
	switch r.Form.Get("grant_type") {
	case "authorization_code":
		g, ok := f.codes[r.Form.Get("code")]
		delete(f.codes, r.Form.Get("code"))
		sum := sha256.Sum256([]byte(r.Form.Get("code_verifier")))
		if !ok || base64.RawURLEncoding.EncodeToString(sum[:]) != g.challenge {
			writeTestJSON(w, 400, map[string]string{"error": "invalid_grant"})
			return
		}
		nonce := g.nonce
		if f.badNonce {
			nonce = "nonce-sesi-lain"
		}
		rt := rand.Text()
		f.refresh[rt] = true
		writeTestJSON(w, 200, map[string]any{
			"id_token": f.sign(map[string]any{
				"iss": f.srv.URL, "sub": g.sub, "aud": testClientID, "nonce": nonce,
				"email": g.email, "name": "Orang " + g.sub,
				"iat": time.Now().Unix(), "exp": time.Now().Add(time.Hour).Unix(),
			}),
			"refresh_token": rt, "token_type": "Bearer",
		})
	case "refresh_token":
		if f.refreshStatus != 0 {
			writeTestJSON(w, f.refreshStatus, map[string]string{"error": "invalid_grant"})
			return
		}
		old := r.Form.Get("refresh_token")
		if !f.refresh[old] {
			writeTestJSON(w, 400, map[string]string{"error": "invalid_grant"})
			return
		}
		delete(f.refresh, old)
		rt := rand.Text()
		f.refresh[rt] = true
		writeTestJSON(w, 200, map[string]any{"refresh_token": rt})
	default:
		writeTestJSON(w, 400, map[string]string{"error": "unsupported_grant_type"})
	}
}

func (f *fakeIdP) sign(claims map[string]any) string {
	enc := func(v any) string {
		b, _ := json.Marshal(v)
		return base64.RawURLEncoding.EncodeToString(b)
	}
	signed := enc(map[string]string{"alg": "ES256", "kid": "k1", "typ": "JWT"}) + "." + enc(claims)
	sum := sha256.Sum256([]byte(signed))
	r, s, err := ecdsa.Sign(rand.Reader, f.key, sum[:])
	if err != nil {
		panic(err)
	}
	sig := make([]byte, 64)
	r.FillBytes(sig[:32])
	s.FillBytes(sig[32:])
	return signed + "." + base64.RawURLEncoding.EncodeToString(sig)
}

func writeTestJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// gonsuApp adalah aplikasi dengan login GONSU menunjuk fakeIdP.
type gonsuApp struct {
	h    http.Handler
	a    app
	idp  *fakeIdP
	pool *pgxpool.Pool
}

func newGonsuApp(t *testing.T, owner string) gonsuApp {
	t.Helper()
	return newGonsuAppOn(t, testdb.New(t), newFakeIdP(t), owner)
}

// newGonsuAppOn: aplikasi cloud dengan login GONSU menunjuk idp, di database
// pool — bentuk Secret yang diserahkan GONSU.
func newGonsuAppOn(t *testing.T, pool *pgxpool.Pool, idp *fakeIdP, owner string) gonsuApp {
	t.Helper()
	a, err := prepare(context.Background(), pool, config.Config{Getenv: env(map[string]string{
		"GONSU_OIDC_ISSUER":       idp.srv.URL,
		"GONSU_OIDC_CLIENT_ID":    testClientID,
		"GONSU_OIDC_REDIRECT_URI": testRedirect,
		"GONSU_OWNER_SUBJECT":     owner,
	})}, quiet)
	if err != nil {
		t.Fatal(err)
	}
	return gonsuApp{h: serve(t, a), a: a, idp: idp, pool: pool}
}

func env(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

func (g gonsuApp) grant(t *testing.T, sub, role string) {
	t.Helper()
	if _, err := authn.Grant(context.Background(), g.pool, entitlement.Noop{}, g.a.org,
		authn.GrantInput{Subject: sub, Role: role, Actor: operator}); err != nil {
		t.Fatal(err)
	}
}

func cookieNamed(resp *http.Response, name string) *http.Cookie {
	for _, c := range resp.Cookies() {
		if c.Name == name {
			return c
		}
	}
	return nil
}

// login menempuh alur penuh: jalur masuk milik GONSU → GONSU (tiruan) →
// balikan. Mengembalikan response balikan beserta alamat dan cookie untuk
// memutarnya ulang.
func (g gonsuApp) login(t *testing.T, sub, next string) (*http.Response, string, *http.Cookie) {
	t.Helper()
	path := web.LoginPath
	if next != "" {
		path += "?next=" + url.QueryEscape(next)
	}
	start := do(t, g.h, call{method: http.MethodGet, path: path})
	attempt := cookieNamed(start, attemptCookie)
	if start.StatusCode != http.StatusSeeOther || attempt == nil || !attempt.HttpOnly || !attempt.Secure {
		t.Fatalf("mulai login = %d, cookie %+v", start.StatusCode, attempt)
	}
	state, code := g.idp.authorize(t, start.Header.Get("Location"), sub)
	callback := web.CallbackPath + "?" + url.Values{"state": {state}, "code": {code}}.Encode()
	return do(t, g.h, call{method: http.MethodGet, path: callback, cookie: attempt}), callback, attempt
}

func me(t *testing.T, h http.Handler, c *http.Cookie) (int, map[string]any) {
	t.Helper()
	resp := do(t, h, call{method: http.MethodGet, path: "/v1/me", cookie: c})
	var body map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&body)
	return resp.StatusCode, body
}

// /auth/login milik aplikasi — tujuan tombol "Masuk" dan pengalihan saat sesi
// habis — menuju jalur masuk milik GONSU, membawa `next` hanya bila menunjuk
// halaman di aplikasi ini.
func TestAppLoginLeadsToGonsu(t *testing.T) {
	g := newGonsuApp(t, "")
	tests := map[string]string{
		"/auth/login":                           web.LoginPath,
		"/auth/login?next=%2Fnotes%2F%3Fid%3D1": web.LoginPath + "?next=%2Fnotes%2F%3Fid%3D1",
		"/auth/login?next=%2F%2Fpenyerang.test": web.LoginPath,
	}
	for path, want := range tests {
		resp := do(t, g.h, call{method: http.MethodGet, path: path})
		if resp.StatusCode != http.StatusSeeOther || resp.Header.Get("Location") != want || len(resp.Cookies()) != 0 {
			t.Errorf("GET %s = %d → %q, cookie %v; want → %q", path, resp.StatusCode,
				resp.Header.Get("Location"), resp.Cookies(), want)
		}
	}
}

// Pembatas laju login hanya di balikan — satu-satunya jalur yang memproses
// kredensial. Jalur kit lainnya tidak ikut menghabiskan jatahnya.
func TestOnlyCallbackIsRateLimited(t *testing.T) {
	g := newGonsuApp(t, "")
	limited := false
	for range 40 {
		if do(t, g.h, call{method: http.MethodGet, path: web.CallbackPath}).StatusCode == http.StatusTooManyRequests {
			limited = true
			break
		}
	}
	if !limited {
		t.Fatal("balikan login tidak pernah dibatasi")
	}
	for _, path := range []string{web.LoginPath, "/auth/login", web.ForgotPasswordPath} {
		if resp := do(t, g.h, call{method: http.MethodGet, path: path}); resp.StatusCode == http.StatusTooManyRequests {
			t.Errorf("GET %s ikut dibatasi", path)
		}
	}
}

func TestGonsuLoginIssuesAppSession(t *testing.T) {
	g := newGonsuApp(t, "")
	g.grant(t, "usr_staff", authz.RoleStaff)

	resp, callback, attempt := g.login(t, "usr_staff", "/notes/")
	session := cookieNamed(resp, authn.CookieName)
	if resp.StatusCode != http.StatusSeeOther || resp.Header.Get("Location") != "/notes/" || session == nil {
		t.Fatalf("balikan = %d → %q", resp.StatusCode, resp.Header.Get("Location"))
	}
	if !session.HttpOnly || !session.Secure || session.SameSite != http.SameSiteLaxMode {
		t.Errorf("cookie sesi = %+v", session)
	}
	status, body := me(t, g.h, session)
	if status != 200 || body["auth_kind"] != "GONSU" || body["role"] != "staff" || body["email"] != "usr_staff@example.test" {
		t.Errorf("/v1/me = %d %v", status, body)
	}
	// Balikan yang sama tidak dapat diputar ulang.
	again := do(t, g.h, call{method: http.MethodGet, path: callback, cookie: attempt})
	if again.Header.Get("Location") != "/sign-in/?error=expired" || cookieNamed(again, authn.CookieName) != nil {
		t.Errorf("balikan diputar ulang = %d → %q", again.StatusCode, again.Header.Get("Location"))
	}
}

// Terbukti login bukan berarti berhak masuk. Orang yang
// tidak diberi akses ditolak — dan tidak dibuatkan akun.
func TestGonsuLoginRejectsUngrantedPerson(t *testing.T) {
	g := newGonsuApp(t, "")
	g.grant(t, "usr_admin", authz.RoleAdministrator)

	resp, _, _ := g.login(t, "usr_other_installation", "")
	if resp.Header.Get("Location") != "/sign-in/?error=not-granted" || cookieNamed(resp, authn.CookieName) != nil {
		t.Fatalf("orang tanpa akses = %d → %q", resp.StatusCode, resp.Header.Get("Location"))
	}
	var n int
	if err := g.pool.QueryRow(context.Background(), "SELECT count(*) FROM application_users WHERE external_subject = $1",
		"usr_other_installation").Scan(&n); err != nil || n != 0 {
		t.Errorf("pengguna tercipta dari login: %d, %v", n, err)
	}
}

func TestGonsuLoginRejectsTokenForAnotherSession(t *testing.T) {
	g := newGonsuApp(t, "")
	g.grant(t, "usr_staff", authz.RoleStaff)
	g.idp.badNonce = true
	resp, _, _ := g.login(t, "usr_staff", "")
	if resp.Header.Get("Location") != "/sign-in/?error=rejected" || cookieNamed(resp, authn.CookieName) != nil {
		t.Errorf("nonce sesi lain = %d → %q", resp.StatusCode, resp.Header.Get("Location"))
	}
}

// Balikan yang tidak berasal dari login yang dimulai di browser ini (tanpa
// cookie percobaan, atau state lain) ditolak sebelum code ditukar.
func TestGonsuCallbackNeedsOwnAttempt(t *testing.T) {
	g := newGonsuApp(t, "")
	g.grant(t, "usr_staff", authz.RoleStaff)
	start := do(t, g.h, call{method: http.MethodGet, path: web.LoginPath})
	_, code := g.idp.authorize(t, start.Header.Get("Location"), "usr_staff")

	noCookie := do(t, g.h, call{method: http.MethodGet, path: web.CallbackPath + "?state=x&code=" + code})
	wrongState := do(t, g.h, call{method: http.MethodGet, path: web.CallbackPath + "?state=bukan&code=" + code,
		cookie: cookieNamed(start, attemptCookie)})
	for name, resp := range map[string]*http.Response{"tanpa cookie": noCookie, "state lain": wrongState} {
		if resp.Header.Get("Location") != "/sign-in/?error=expired" || cookieNamed(resp, authn.CookieName) != nil {
			t.Errorf("%s = %d → %q", name, resp.StatusCode, resp.Header.Get("Location"))
		}
	}
}

// Pemilik pemasangan menurut GONSU menjadi admin pertama hanya selama
// pemasangan belum memberi akses kepada siapa pun.
func TestGonsuOwnerBecomesFirstAdmin(t *testing.T) {
	g := newGonsuApp(t, "usr_owner")

	if resp, _, _ := g.login(t, "usr_not_owner", ""); resp.Header.Get("Location") != "/sign-in/?error=not-granted" {
		t.Fatalf("bukan pemilik = %q", resp.Header.Get("Location"))
	}

	// Dua login pemilik bersamaan: keduanya masuk, satu baris pengguna.
	var wg sync.WaitGroup
	results := make([]*http.Response, 2)
	for i := range results {
		wg.Go(func() { results[i], _, _ = g.login(t, "usr_owner", "") })
	}
	wg.Wait()
	for i, resp := range results {
		status, body := me(t, g.h, cookieNamed(resp, authn.CookieName))
		if status != 200 || body["role"] != "administrator" {
			t.Errorf("login pemilik %d: /v1/me = %d %v", i, status, body)
		}
	}
	users, err := authn.Users(context.Background(), g.pool, g.a.org)
	if err != nil || len(users) != 1 {
		t.Fatalf("pengguna = %+v, %v", users, err)
	}
	if n := countRows(t, g.pool, `SELECT count(*) FROM user_access_events WHERE source = 'OWNER_BOOTSTRAP'
		AND action = 'GRANTED' AND role_after = 'administrator'`); n != 1 {
		t.Errorf("riwayat bootstrap pemilik = %d baris, want 1", n)
	}

	// Sesudah ada satu baris, pemilik lain tidak dapat menyuntikkan diri.
	late := newGonsuAppOn(t, g.pool, g.idp, "usr_new_owner")
	if resp, _, _ := late.login(t, "usr_new_owner", ""); resp.Header.Get("Location") != "/sign-in/?error=not-granted" {
		t.Errorf("pemilik baru pada pemasangan berjalan = %q", resp.Header.Get("Location"))
	}
}

func setLastChecked(t *testing.T, pool *pgxpool.Pool, ago time.Duration) {
	t.Helper()
	if _, err := pool.Exec(context.Background(),
		"UPDATE sessions SET last_checked_at = now() - make_interval(secs => $1) WHERE revoked_at IS NULL",
		ago.Seconds()); err != nil {
		t.Fatal(err)
	}
}

func refreshToken(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	var rt string
	if err := pool.QueryRow(context.Background(),
		"SELECT refresh_token FROM sessions WHERE revoked_at IS NULL AND auth_kind = 'GONSU'").Scan(&rt); err != nil {
		t.Fatal(err)
	}
	return rt
}

// Pencabutan menjangkau sesi yang sudah berjalan: GONSU menolak → sesi mati seketika; GONSU tak terjangkau →
// sesi bertahan selama masa tenggang.
func TestGonsuSessionRecheck(t *testing.T) {
	g := newGonsuApp(t, "")
	g.grant(t, "usr_staff", authz.RoleStaff)
	resp, _, _ := g.login(t, "usr_staff", "")
	session := cookieNamed(resp, authn.CookieName)

	before := refreshToken(t, g.pool)
	setLastChecked(t, g.pool, 20*time.Minute)
	if status, _ := me(t, g.h, session); status != 200 {
		t.Fatalf("pemeriksaan berhasil = %d", status)
	}
	if after := refreshToken(t, g.pool); after == before {
		t.Error("refresh token yang dirotasi tidak disimpan")
	}

	// GONSU tak terjangkau (5xx), masih dalam masa tenggang 12 jam.
	g.idp.refreshStatus = http.StatusServiceUnavailable
	setLastChecked(t, g.pool, time.Hour)
	if status, _ := me(t, g.h, session); status != 200 {
		t.Errorf("GONSU tak terjangkau dalam masa tenggang = %d, want 200", status)
	}
	// Melewati masa tenggang.
	setLastChecked(t, g.pool, 13*time.Hour)
	if status, _ := me(t, g.h, session); status != 401 {
		t.Errorf("melewati masa tenggang = %d, want 401", status)
	}

	// Login baru, lalu GONSU menolak (orangnya dicabut): mati seketika.
	g.idp.refreshStatus = 0
	resp, _, _ = g.login(t, "usr_staff", "")
	session = cookieNamed(resp, authn.CookieName)
	g.idp.refreshStatus = http.StatusBadRequest
	setLastChecked(t, g.pool, 20*time.Minute)
	if status, _ := me(t, g.h, session); status != 401 {
		t.Errorf("GONSU menolak = %d, want 401", status)
	}
	g.idp.refreshStatus = 0
	if status, _ := me(t, g.h, session); status != 401 {
		t.Errorf("sesi yang dicabut hidup lagi = %d", status)
	}
}

func TestGonsuLogout(t *testing.T) {
	g := newGonsuApp(t, "")
	g.grant(t, "usr_staff", authz.RoleStaff)
	resp, _, _ := g.login(t, "usr_staff", "")
	session := cookieNamed(resp, authn.CookieName)

	csrf := do(t, g.h, call{method: http.MethodPost, path: "/auth/logout", cookie: session,
		header: map[string]string{"Sec-Fetch-Site": "cross-site"}})
	if csrf.StatusCode != http.StatusForbidden {
		t.Errorf("logout lintas origin = %d, want 403", csrf.StatusCode)
	}

	out := do(t, g.h, call{method: http.MethodPost, path: "/auth/logout", cookie: session})
	loc, _ := url.Parse(out.Header.Get("Location"))
	if out.StatusCode != http.StatusSeeOther || !strings.HasPrefix(loc.String(), g.idp.srv.URL+"/logout?") ||
		loc.Query().Get("id_token_hint") == "" || loc.Query().Get("post_logout_redirect_uri") != testRedirect {
		t.Errorf("logout = %d → %q", out.StatusCode, loc)
	}
	if c := cookieNamed(out, authn.CookieName); c == nil || c.MaxAge >= 0 {
		t.Errorf("cookie sesi tidak dihapus: %+v", c)
	}
	if status, _ := me(t, g.h, session); status != 401 {
		t.Errorf("sesi sesudah logout = %d, want 401", status)
	}
	// GONSU mengembalikan pengguna ke alamat balikan tanpa code.
	back := do(t, g.h, call{method: http.MethodGet, path: web.CallbackPath})
	if back.Header.Get("Location") != "/" {
		t.Errorf("balikan sesudah logout = %q", back.Header.Get("Location"))
	}
}

// "Akun saya" dan lupa sandi menuju GONSU; aplikasi tidak punya layar sandi.
// "Akun saya" membawa alamat kembali ke halaman asal di aplikasi.
func TestAccountLinksGoToGonsu(t *testing.T) {
	g := newGonsuApp(t, "")
	tests := map[string]string{
		web.AccountPath + "?return=%2Fnotes%2F": g.idp.srv.URL + "/account?redirect=" +
			url.QueryEscape("https://app.example.test/notes/"),
		web.ForgotPasswordPath: g.idp.srv.URL + "/forgot-password",
	}
	for path, want := range tests {
		resp := do(t, g.h, call{method: http.MethodGet, path: path})
		if resp.StatusCode != http.StatusSeeOther || resp.Header.Get("Location") != want {
			t.Errorf("%s = %d → %q, want %q", path, resp.StatusCode, resp.Header.Get("Location"), want)
		}
	}
}

// Kuota users.max dari lisensi ditegakkan saat memberi akses: batasnya di
// pemberian akses, bukan satu gerbang di awal.
func TestGrantRespectsUsersMax(t *testing.T) {
	pool := testdb.New(t)
	agent := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, `{"allowed":true,"state":"active","granted":true,"entitlements":{"produk-contoh.core":true,"users.max":2}}`)
	}))
	defer agent.Close()
	a, err := prepare(context.Background(), pool, config.Config{Getenv: env(map[string]string{"GONSU_AGENT_URL": agent.URL})}, quiet)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	for i := range 2 {
		if _, err := authn.Grant(ctx, pool, a.license, a.org, authn.GrantInput{Subject: fmt.Sprintf("usr_%d", i), Role: "viewer", Actor: operator}); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := authn.Grant(ctx, pool, a.license, a.org, authn.GrantInput{Subject: "usr_third", Role: "viewer", Actor: operator}); err == nil {
		t.Fatal("kuota users.max dilewati")
	}
	// Memperbarui orang yang sudah aktif tidak menghitung ulang.
	if _, err := authn.Grant(ctx, pool, a.license, a.org, authn.GrantInput{Subject: "usr_0", Role: "staff", Actor: operator}); err != nil {
		t.Errorf("memperbarui role pengguna aktif: %v", err)
	}
	// Mencabut membebaskan kuota, dan sesinya ikut diakhiri.
	if err := authn.Suspend(ctx, pool, a.org, "usr_1", operator); err != nil {
		t.Fatal(err)
	}
	if _, err := authn.Grant(ctx, pool, a.license, a.org, authn.GrantInput{Subject: "usr_third", Role: "viewer", Actor: operator}); err != nil {
		t.Errorf("sesudah satu dicabut: %v", err)
	}
	if err := authn.Suspend(ctx, pool, a.org, "usr_missing", operator); err == nil {
		t.Error("mencabut sub yang tidak ada harus galat")
	}
}
