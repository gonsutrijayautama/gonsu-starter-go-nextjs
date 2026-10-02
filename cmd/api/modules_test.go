package main

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/png"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authz"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/config"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/testdb"
)

type profileResponse struct {
	DisplayName string `json:"display_name"`
	TaxID       string `json:"tax_id"`
	Postcode    string `json:"postcode"`
	AddressText string `json:"address_text"`
	Region      *struct {
		Label string `json:"label"`
	} `json:"region"`
	Logo *struct {
		URL         string `json:"url"`
		ContentType string `json:"content_type"`
	} `json:"logo"`
}

func decodeProfile(t *testing.T, resp *http.Response) profileResponse {
	t.Helper()
	var p profileResponse
	if err := json.NewDecoder(resp.Body).Decode(&p); err != nil {
		t.Fatalf("profil bukan JSON: %v", err)
	}
	return p
}

func logoPNG(t *testing.T) string {
	t.Helper()
	var buf bytes.Buffer
	if err := png.Encode(&buf, image.NewRGBA(image.Rect(0, 0, 24, 24))); err != nil {
		t.Fatal(err)
	}
	return buf.String()
}

const profileBody = `{"display_name": "Toko Baju Sejahtera", "tax_id": "01.234.567.8-901.000",
	"address": "Jl. Pasteur No. 10", "region_code": "32.73.07.1001"}`

// Modul standar dari library dipasang dengan penjagaan yang sama seperti
// modul produk: sesi, izin dari matriks authz, dan envelope galat yang sama.
func TestBusinessProfileOverHTTP(t *testing.T) {
	pool := testdb.New(t)
	app := newApp(t, pool)
	_, a := testdb.Tenant(t, pool, authz.RoleAdministrator)
	_, s := testdb.User(t, pool, a.OrganizationID, authz.RoleStaff)
	admin, staff := sessionFor(t, pool, a, time.Hour), sessionFor(t, pool, s, time.Hour)

	// Setiap pengguna boleh membaca; sebelum disimpan isinya kosong.
	resp := do(t, app, call{method: http.MethodGet, path: "/v1/business-profile", cookie: staff})
	if p := decodeProfile(t, resp); resp.StatusCode != http.StatusOK || p.DisplayName != "" {
		t.Fatalf("GET sebelum disimpan = %d, %+v", resp.StatusCode, p)
	}

	// Mengubah butuh izin settings.business.manage.
	resp = do(t, app, call{method: http.MethodPut, path: "/v1/business-profile", body: profileBody, cookie: staff})
	if resp.StatusCode != http.StatusForbidden || errorCode(t, resp) != apperr.CodePermissionDenied {
		t.Errorf("PUT oleh staf = %d, ingin 403 PERMISSION_DENIED", resp.StatusCode)
	}

	resp = do(t, app, call{method: http.MethodPut, path: "/v1/business-profile", body: profileBody, cookie: admin})
	p := decodeProfile(t, resp)
	if resp.StatusCode != http.StatusOK || p.DisplayName != "Toko Baju Sejahtera" {
		t.Fatalf("PUT oleh administrator = %d, %+v", resp.StatusCode, p)
	}
	// NPWP dinormalkan, kode pos dan nama wilayah diturunkan dari kodenya.
	if p.TaxID != "0012345678901000" || p.Postcode != "40161" || p.Region == nil ||
		p.AddressText != "Jl. Pasteur No. 10, Desa Pasteur, Kecamatan Sukajadi, Kota Bandung, Jawa Barat 40161" {
		t.Errorf("profil tersimpan = %+v", p)
	}

	// Staf melihat yang disimpan administrator.
	if p := decodeProfile(t, do(t, app, call{method: http.MethodGet, path: "/v1/business-profile", cookie: staff})); p.DisplayName != "Toko Baju Sejahtera" {
		t.Errorf("GET oleh staf = %+v", p)
	}
}

func TestBusinessProfileGuards(t *testing.T) {
	pool := testdb.New(t)
	app := newApp(t, pool)
	_, a := testdb.Tenant(t, pool, authz.RoleAdministrator)
	admin := sessionFor(t, pool, a, time.Hour)

	tests := []struct {
		name   string
		c      call
		status int
		code   string
	}{
		{"tanpa sesi", call{method: http.MethodGet, path: "/v1/business-profile"},
			http.StatusUnauthorized, apperr.CodeUnauthenticated},
		{"wilayah tanpa sesi", call{method: http.MethodGet, path: "/v1/regions"},
			http.StatusUnauthorized, apperr.CodeUnauthenticated},
		{"mutasi lintas origin (CSRF)", call{method: http.MethodPut, path: "/v1/business-profile", body: profileBody, cookie: admin,
			header: map[string]string{"Sec-Fetch-Site": "cross-site"}},
			http.StatusForbidden, apperr.CodePermissionDenied},
		{"nama bisnis kosong", call{method: http.MethodPut, path: "/v1/business-profile", body: `{"display_name": " "}`, cookie: admin},
			http.StatusBadRequest, apperr.CodeValidationFailed},
		// organization_id palsu di body tidak boleh diterima: field yang
		// tidak dikenal ditolak, dan scope hanya datang dari sesi.
		{"organization_id dari body", call{method: http.MethodPut, path: "/v1/business-profile", cookie: admin,
			body: `{"display_name": "A", "organization_id": "00000000-0000-0000-0000-000000000000"}`},
			http.StatusBadRequest, apperr.CodeValidationFailed},
		{"wilayah tak dikenal", call{method: http.MethodGet, path: "/v1/regions?parent=99", cookie: admin},
			http.StatusBadRequest, apperr.CodeValidationFailed},
		{"logo bukan gambar", call{method: http.MethodPut, path: "/v1/business-profile/logo", body: "<svg/>", cookie: admin},
			http.StatusBadRequest, apperr.CodeValidationFailed},
		{"media yang tidak ada", call{method: http.MethodGet, path: "/media/00000000-0000-0000-0000-000000000000"},
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
}

// Logo diunggah lewat API bersesi, lalu dibaca TANPA sesi: ia tampil di
// halaman depan dan halaman masuk.
func TestBusinessLogoIsPublic(t *testing.T) {
	pool := testdb.New(t)
	app := newApp(t, pool)
	_, a := testdb.Tenant(t, pool, authz.RoleAdministrator)
	admin := sessionFor(t, pool, a, time.Hour)

	resp := do(t, app, call{method: http.MethodPut, path: "/v1/business-profile/logo", body: logoPNG(t), cookie: admin,
		header: map[string]string{"Content-Type": "image/png"}})
	p := decodeProfile(t, resp)
	if resp.StatusCode != http.StatusOK || p.Logo == nil || p.Logo.ContentType != "image/png" {
		t.Fatalf("unggah logo = %d, %+v", resp.StatusCode, p.Logo)
	}

	public := do(t, app, call{method: http.MethodGet, path: p.Logo.URL})
	if public.StatusCode != http.StatusOK || public.Header.Get("Content-Type") != "image/png" {
		t.Errorf("GET %s tanpa sesi = %d %q", p.Logo.URL, public.StatusCode, public.Header.Get("Content-Type"))
	}

	resp = do(t, app, call{method: http.MethodDelete, path: "/v1/business-profile/logo", cookie: admin})
	if p := decodeProfile(t, resp); resp.StatusCode != http.StatusOK || p.Logo != nil {
		t.Errorf("hapus logo = %d, %+v", resp.StatusCode, p.Logo)
	}
	if gone := do(t, app, call{method: http.MethodGet, path: p.Logo.URL}); gone.StatusCode != http.StatusNotFound {
		t.Errorf("logo yang dihapus masih dapat dibuka: %d", gone.StatusCode)
	}
}

// Profil pemasangan lain tidak terlihat dan tidak ikut berubah.
func TestBusinessProfileIsTenantScoped(t *testing.T) {
	pool := testdb.New(t)
	app := newApp(t, pool)
	_, a := testdb.Tenant(t, pool, authz.RoleAdministrator)
	_, b := testdb.Tenant(t, pool, authz.RoleAdministrator)
	ca, cb := sessionFor(t, pool, a, time.Hour), sessionFor(t, pool, b, time.Hour)

	if resp := do(t, app, call{method: http.MethodPut, path: "/v1/business-profile", body: profileBody, cookie: ca}); resp.StatusCode != http.StatusOK {
		t.Fatalf("menyimpan profil A = %d", resp.StatusCode)
	}
	if p := decodeProfile(t, do(t, app, call{method: http.MethodGet, path: "/v1/business-profile", cookie: cb})); p.DisplayName != "" {
		t.Errorf("pemasangan B melihat profil A: %+v", p)
	}
	if resp := do(t, app, call{method: http.MethodPut, path: "/v1/business-profile", body: `{"display_name": "Bisnis B"}`, cookie: cb}); resp.StatusCode != http.StatusOK {
		t.Fatalf("menyimpan profil B = %d", resp.StatusCode)
	}
	if p := decodeProfile(t, do(t, app, call{method: http.MethodGet, path: "/v1/business-profile", cookie: ca})); p.DisplayName != "Toko Baju Sejahtera" {
		t.Errorf("profil A berubah oleh pemasangan B: %+v", p)
	}
}

// Wilayah: anak langsung sebuah kode, untuk pemilih alamat bertingkat.
func TestRegionsOverHTTP(t *testing.T) {
	pool := testdb.New(t)
	app := newApp(t, pool)
	_, v := testdb.Tenant(t, pool, authz.RoleViewer)
	viewer := sessionFor(t, pool, v, time.Hour)

	for path, want := range map[string]string{
		"/v1/regions":                          "Jawa Barat",
		"/v1/regions?parent=32":                "Kota Bandung",
		"/v1/regions/search?q=pasteur&limit=5": "Pasteur",
	} {
		resp := do(t, app, call{method: http.MethodGet, path: path, cookie: viewer})
		var list struct {
			Data []struct {
				Name string `json:"name"`
			} `json:"data"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&list); err != nil || resp.StatusCode != http.StatusOK {
			t.Fatalf("GET %s = %d, %v", path, resp.StatusCode, err)
		}
		found := false
		for _, it := range list.Data {
			found = found || it.Name == want
		}
		if !found {
			t.Errorf("GET %s tidak memuat %q", path, want)
		}
	}
}

const websiteBody = `{"mode": "site", "tagline": "Pakaian rapi untuk setiap hari",
	"services": [{"title": "Jahit ukuran", "description": "Dijahit sesuai ukuran badan.", "icon": "wrench"}],
	"channels": {"whatsapp": "0812-3456-7890"}, "version": 0}`

type websiteResponse struct {
	Mode     string `json:"mode"`
	Tagline  string `json:"tagline"`
	Version  int    `json:"version"`
	Channels struct {
		WhatsApp string `json:"whatsapp"`
	} `json:"channels"`
}

func decodeWebsite(t *testing.T, resp *http.Response) websiteResponse {
	t.Helper()
	var s websiteResponse
	if err := json.NewDecoder(resp.Body).Decode(&s); err != nil {
		t.Fatalf("pengaturan website bukan JSON: %v", err)
	}
	return s
}

// Pengaturan website: dibaca setiap pengguna, diubah pemegang izin
// settings.website.manage, dan simpan dengan version lama ditolak.
func TestWebsiteOverHTTP(t *testing.T) {
	pool := testdb.New(t)
	app := newApp(t, pool)
	_, a := testdb.Tenant(t, pool, authz.RoleAdministrator)
	_, s := testdb.User(t, pool, a.OrganizationID, authz.RoleStaff)
	admin, staff := sessionFor(t, pool, a, time.Hour), sessionFor(t, pool, s, time.Hour)

	// Bawaannya hanya pintu masuk.
	resp := do(t, app, call{method: http.MethodGet, path: "/v1/website", cookie: staff})
	if w := decodeWebsite(t, resp); resp.StatusCode != http.StatusOK || w.Mode != "signin" || w.Version != 0 {
		t.Fatalf("GET sebelum disimpan = %d, %+v", resp.StatusCode, w)
	}

	resp = do(t, app, call{method: http.MethodPut, path: "/v1/website", body: websiteBody, cookie: staff})
	if resp.StatusCode != http.StatusForbidden || errorCode(t, resp) != apperr.CodePermissionDenied {
		t.Errorf("PUT oleh staf = %d, ingin 403 PERMISSION_DENIED", resp.StatusCode)
	}
	if resp := do(t, app, call{method: http.MethodGet, path: "/v1/website"}); resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("GET tanpa sesi = %d, ingin 401", resp.StatusCode)
	}

	resp = do(t, app, call{method: http.MethodPut, path: "/v1/website", body: websiteBody, cookie: admin})
	w := decodeWebsite(t, resp)
	if resp.StatusCode != http.StatusOK || w.Mode != "site" || w.Version != 1 || w.Channels.WhatsApp != "6281234567890" {
		t.Fatalf("PUT oleh administrator = %d, %+v", resp.StatusCode, w)
	}

	// Formulir lain yang masih memegang version 0: ditolak, bukan menimpa.
	resp = do(t, app, call{method: http.MethodPut, path: "/v1/website", body: websiteBody, cookie: admin})
	if resp.StatusCode != http.StatusConflict || errorCode(t, resp) != apperr.CodeConcurrentModification {
		t.Errorf("PUT dengan version lama = %d, ingin 409 CONCURRENT_MODIFICATION", resp.StatusCode)
	}

	// Tautan berskema lain tidak pernah sampai ke halaman publik.
	bad := `{"mode": "site", "contact": {"map_url": "javascript:alert(1)"}, "version": 1}`
	resp = do(t, app, call{method: http.MethodPut, path: "/v1/website", body: bad, cookie: admin})
	if resp.StatusCode != http.StatusBadRequest || errorCode(t, resp) != apperr.CodeValidationFailed {
		t.Errorf("tautan javascript: = %d, ingin 400 VALIDATION_FAILED", resp.StatusCode)
	}
}

// Profil bisnis pun dijaga dari simpan-bersamaan.
func TestBusinessProfileRejectsStaleVersion(t *testing.T) {
	pool := testdb.New(t)
	app := newApp(t, pool)
	_, a := testdb.Tenant(t, pool, authz.RoleAdministrator)
	admin := sessionFor(t, pool, a, time.Hour)

	if resp := do(t, app, call{method: http.MethodPut, path: "/v1/business-profile", body: profileBody, cookie: admin}); resp.StatusCode != http.StatusOK {
		t.Fatalf("simpan pertama = %d", resp.StatusCode)
	}
	resp := do(t, app, call{method: http.MethodPut, path: "/v1/business-profile", body: profileBody, cookie: admin})
	if resp.StatusCode != http.StatusConflict || errorCode(t, resp) != apperr.CodeConcurrentModification {
		t.Errorf("simpan kedua dengan version 0 = %d, ingin 409 CONCURRENT_MODIFICATION", resp.StatusCode)
	}
	next := `{"display_name": "Toko Baju", "version": 1}`
	if resp := do(t, app, call{method: http.MethodPut, path: "/v1/business-profile", body: next, cookie: admin}); resp.StatusCode != http.StatusOK {
		t.Errorf("simpan dengan version terbaru = %d", resp.StatusCode)
	}
}

// Halaman depan dibuka TANPA sesi dan membawa identitas bisnis pemasangan
// ini: judul dan tag pratinjau tautan untuk layanan yang tidak menjalankan
// JavaScript, dan datanya untuk frontend.
func TestHomePageCarriesBusinessIdentity(t *testing.T) {
	pool := testdb.New(t)
	ctx := context.Background()
	a, err := prepare(ctx, pool, config.Config{}, quiet)
	if err != nil {
		t.Fatal(err)
	}
	app := serve(t, a)
	home := func() string {
		t.Helper()
		resp := do(t, app, call{method: http.MethodGet, path: "/"})
		raw, _ := io.ReadAll(resp.Body)
		// "/" adalah probe chart GONSU: selalu 200, tanpa sesi.
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("GET / = %d", resp.StatusCode)
		}
		return string(raw)
	}

	// Sebelum ada yang diisi: halaman build apa adanya, dengan mode pintu masuk.
	page := home()
	if !strings.Contains(page, "<title>Aplikasi</title>") || !strings.Contains(page, `"mode":"signin"`) || !strings.Contains(page, "halaman depan") {
		t.Errorf("halaman depan sebelum diisi:\n%s", page)
	}

	// Administrator pemasangan ini mengisi profil dan menyalakan web perusahaan.
	_, p := testdb.User(t, pool, a.org, authz.RoleAdministrator)
	admin := sessionFor(t, pool, p, time.Hour)
	for path, body := range map[string]string{"/v1/business-profile": profileBody, "/v1/website": websiteBody} {
		if resp := do(t, app, call{method: http.MethodPut, path: path, body: body, cookie: admin}); resp.StatusCode != http.StatusOK {
			t.Fatalf("PUT %s = %d", path, resp.StatusCode)
		}
	}

	page = home()
	for _, want := range []string{
		"<title>Toko Baju Sejahtera — Pakaian rapi untuk setiap hari</title>",
		`<meta property="og:title" content="Toko Baju Sejahtera — Pakaian rapi untuk setiap hari"/>`,
		`<script id="gonsu-site" type="application/json">`,
		`"mode":"site"`, `"whatsapp":"https://wa.me/6281234567890"`,
		"halaman depan",
	} {
		if !strings.Contains(page, want) {
			t.Errorf("halaman depan tidak memuat %s\n%s", want, page)
		}
	}
	// NPWP ada di profil, dan tidak pernah di halaman publik.
	if strings.Contains(page, "0012345678901000") || strings.Contains(page, "tax_id") {
		t.Errorf("halaman depan memuat NPWP:\n%s", page)
	}

	// Data yang sama tersedia tanpa sesi di /site.json.
	resp := do(t, app, call{method: http.MethodGet, path: "/site.json"})
	var site struct {
		Mode string `json:"mode"`
		Name string `json:"name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&site); err != nil || resp.StatusCode != http.StatusOK ||
		site.Mode != "site" || site.Name != "Toko Baju Sejahtera" {
		t.Errorf("GET /site.json = %d, %+v, %v", resp.StatusCode, site, err)
	}
}
