package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authn"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authz"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/config"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/stockmedia"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/testdb"
)

// fakePixabay meniru API Pixabay: pencarian foto dan video, dan berkas foto.
// photoHost mengganti host alamat foto, untuk meniru jawaban yang menunjuk
// ke luar Pixabay.
type fakePixabay struct {
	*httptest.Server
	searches  atomic.Int64
	downloads atomic.Int64
	status    atomic.Int64
	photoHost atomic.Value
	keys      atomic.Value
	pages     atomic.Value
	// asked: permintaan terakhir per jalur ("/api/", "/api/videos/").
	asked sync.Map
}

func newFakePixabay(t *testing.T) *fakePixabay {
	t.Helper()
	f := &fakePixabay{}
	f.status.Store(http.StatusOK)
	f.photoHost.Store("")
	mux := http.NewServeMux()
	answer := func(w http.ResponseWriter, r *http.Request, body string) {
		f.searches.Add(1)
		f.keys.Store(r.URL.Query().Get("key"))
		f.pages.Store(r.URL.Query().Get("page"))
		f.asked.Store(r.URL.Path, r.URL.Query())
		if status := int(f.status.Load()); status != http.StatusOK {
			http.Error(w, "galat", status)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, body)
	}
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		host, _ := f.photoHost.Load().(string)
		if host == "" {
			host = f.URL
		}
		answer(w, r, `{"total":500,"totalHits":60,"hits":[{"id":101,"tags":"bakso, kuah, makanan","imageWidth":1920,"imageHeight":1280,`+
			`"previewURL":"`+f.URL+`/kecil/101.jpg","webformatURL":"`+host+`/sedang/101_640.jpg","largeImageURL":"`+host+`/besar/101.jpg",`+
			`"pageURL":"https://pixabay.com/photos/101/","user":"dapur"}]}`)
	})
	mux.HandleFunc("/api/videos/", func(w http.ResponseWriter, r *http.Request) {
		answer(w, r, `{"total":1,"totalHits":1,"hits":[{"id":202,"tags":"dapur, memasak","duration":12,"pageURL":"https://pixabay.com/videos/202/","user":"koki",`+
			`"videos":{"medium":{"url":"https://cdn.pixabay.com/video/202_medium.mp4","width":1280,"height":720,"thumbnail":"https://cdn.pixabay.com/video/202_medium.jpg"},`+
			`"small":{"url":"https://cdn.pixabay.com/video/202_small.mp4","width":960,"height":540,"thumbnail":""}}}]}`)
	})
	mux.HandleFunc("/besar/101.jpg", func(w http.ResponseWriter, r *http.Request) {
		f.downloads.Add(1)
		w.Header().Set("Content-Type", "image/jpeg")
		_, _ = io.WriteString(w, "isi-foto")
	})
	f.Server = httptest.NewServer(mux)
	t.Cleanup(f.Close)
	return f
}

type stockApp struct {
	h     http.Handler
	admin *http.Cookie
	staff *http.Cookie
	clock *atomic.Int64
}

// newStockApp: aplikasi yang bertanya ke fake Pixabay. key kosong berarti
// fiturnya tidak dikonfigurasi.
func newStockApp(t *testing.T, f *fakePixabay, key string) stockApp {
	t.Helper()
	pool := testdb.New(t)
	a, err := prepare(context.Background(), pool, config.Config{}, quiet)
	if err != nil {
		t.Fatal(err)
	}
	clock := &atomic.Int64{}
	clock.Store(time.Date(2026, 10, 4, 8, 0, 0, 0, time.UTC).Unix())
	a.stock, err = stockmedia.NewService(stockmedia.Options{
		APIKey: key, BaseURL: f.URL, Logger: quiet, Now: func() time.Time { return time.Unix(clock.Load(), 0) },
	})
	if err != nil {
		t.Fatal(err)
	}
	_, p := testdb.Tenant(t, pool, authz.RoleAdministrator)
	staff, _ := testdb.User(t, pool, p.OrganizationID, authz.RoleStaff)
	sp, _ := authn.PrincipalFrom(staff)
	return stockApp{h: serve(t, a), admin: sessionFor(t, pool, p, time.Hour), staff: sessionFor(t, pool, sp, time.Hour), clock: clock}
}

type stockResponse struct {
	Data struct {
		Photos  []stockmedia.Photo `json:"photos"`
		Videos  []stockmedia.Video `json:"videos"`
		Page    int                `json:"page"`
		HasMore bool               `json:"has_more"`
	} `json:"data"`
	Configured bool   `json:"configured"`
	Source     string `json:"source"`
}

func (a stockApp) search(t *testing.T, category string) (*http.Response, stockResponse, string) {
	t.Helper()
	resp := do(t, a.h, call{method: http.MethodGet, path: "/v1/stock-media?category=" + category, cookie: a.admin})
	raw, _ := io.ReadAll(resp.Body)
	var out stockResponse
	_ = json.Unmarshal(raw, &out)
	return resp, out, string(raw)
}

// Jalur normal, dan ketentuan Pixabay: jawaban yang sama tidak diminta ulang
// selama 24 jam.
func TestStockMediaIsCachedForADay(t *testing.T) {
	f := newFakePixabay(t)
	a := newStockApp(t, f, "kunci-rahasia")

	resp, out, raw := a.search(t, "kuliner")
	if resp.StatusCode != http.StatusOK || !out.Configured || out.Source != "Pixabay" {
		t.Fatalf("pencarian = %d %s", resp.StatusCode, raw)
	}
	if len(out.Data.Photos) != 1 || out.Data.Photos[0].ID != 101 || out.Data.Photos[0].Tags != "bakso, kuah, makanan" {
		t.Errorf("foto = %+v", out.Data.Photos)
	}
	if len(out.Data.Videos) != 1 || out.Data.Videos[0].URL != "https://cdn.pixabay.com/video/202_medium.mp4" || out.Data.Videos[0].Duration != 12 {
		t.Errorf("video = %+v", out.Data.Videos)
	}
	if got, _ := f.keys.Load().(string); got != "kunci-rahasia" {
		t.Errorf("kunci yang dikirim ke Pixabay = %q", got)
	}
	if strings.Contains(raw, "kunci-rahasia") {
		t.Error("kunci API ikut terkirim ke peramban")
	}
	if strings.Contains(raw, "/besar/101.jpg") {
		t.Error("alamat berkas foto ikut terkirim: layar harus mengambilnya lewat /photos/{id}/file")
	}
	// Gambar untuk kisi pustaka media: ukuran 340 dari alamat 640 yang dijawab Pixabay.
	if got := out.Data.Photos[0].ThumbnailURL; !strings.HasSuffix(got, "/sedang/101_340.jpg") {
		t.Errorf("thumbnail = %q", got)
	}

	// Satu pencarian = satu permintaan foto dan satu permintaan video.
	if got := f.searches.Load(); got != 2 {
		t.Fatalf("permintaan ke Pixabay = %d, want 2", got)
	}
	a.search(t, "kuliner")
	a.clock.Add(int64((23 * time.Hour).Seconds()))
	a.search(t, "kuliner")
	if got := f.searches.Load(); got != 2 {
		t.Errorf("sebelum 24 jam Pixabay ditanya lagi: %d permintaan", got)
	}

	a.clock.Add(int64((2 * time.Hour).Seconds()))
	a.search(t, "kuliner")
	if got := f.searches.Load(); got != 4 {
		t.Errorf("sesudah 24 jam: %d permintaan, want 4", got)
	}
}

// Bawaan pustaka media, kategori "acak": tanpa kata pencarian, jadi yang
// datang campuran semua topik, dan yang diminta pilihan editor Pixabay.
func TestStockMediaMixedCategoryAsksWithoutKeyword(t *testing.T) {
	f := newFakePixabay(t)
	a := newStockApp(t, f, "kunci")

	resp, out, raw := a.search(t, stockmedia.Mixed)
	if resp.StatusCode != http.StatusOK || len(out.Data.Photos) != 1 || len(out.Data.Videos) != 1 {
		t.Fatalf("pencarian acak = %d %s", resp.StatusCode, raw)
	}
	for _, path := range []string{"/api/", "/api/videos/"} {
		asked, _ := f.asked.Load(path)
		query, _ := asked.(url.Values)
		if query.Has("q") || query.Get("editors_choice") != "true" || query.Get("safesearch") != "true" {
			t.Errorf("permintaan %s = %v, want tanpa q, dengan editors_choice dan safesearch", path, query)
		}
	}

	// Kategori bertopik tetap membawa kata pencariannya, tanpa pilihan editor.
	a.search(t, "jasa")
	asked, _ := f.asked.Load("/api/")
	if query, _ := asked.(url.Values); query.Get("q") == "" || query.Has("editors_choice") {
		t.Errorf("permintaan kategori bertopik = %v", query)
	}
}

func TestStockMediaGuards(t *testing.T) {
	f := newFakePixabay(t)
	a := newStockApp(t, f, "kunci")

	tests := []struct {
		name   string
		c      call
		status int
		code   string
	}{
		{"tanpa sesi", call{method: http.MethodGet, path: "/v1/stock-media?category=kuliner"},
			http.StatusUnauthorized, apperr.CodeUnauthenticated},
		{"role tanpa izin mengatur website", call{method: http.MethodGet, path: "/v1/stock-media?category=kuliner", cookie: a.staff},
			http.StatusForbidden, apperr.CodePermissionDenied},
		{"foto untuk role tanpa izin", call{method: http.MethodGet, path: "/v1/stock-media/photos/101/file", cookie: a.staff},
			http.StatusForbidden, apperr.CodePermissionDenied},
		{"video untuk role tanpa izin", call{method: http.MethodGet, path: "/v1/stock-media/videos/202", cookie: a.staff},
			http.StatusForbidden, apperr.CodePermissionDenied},
		// Kata pencarian bebas tidak diterima: hanya bidang usaha yang terdaftar.
		{"bidang usaha tak dikenal", call{method: http.MethodGet, path: "/v1/stock-media?category=apa-saja", cookie: a.admin},
			http.StatusBadRequest, apperr.CodeValidationFailed},
		{"tanpa bidang usaha", call{method: http.MethodGet, path: "/v1/stock-media", cookie: a.admin},
			http.StatusBadRequest, apperr.CodeValidationFailed},
		{"id foto bukan angka", call{method: http.MethodGet, path: "/v1/stock-media/photos/abc/file", cookie: a.admin},
			http.StatusNotFound, apperr.CodeResourceNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := do(t, a.h, tt.c)
			if resp.StatusCode != tt.status || errorCode(t, resp) != tt.code {
				t.Errorf("status = %d, want %d %s", resp.StatusCode, tt.status, tt.code)
			}
		})
	}
	if got := f.searches.Load(); got != 0 {
		t.Errorf("permintaan yang ditolak tetap sampai ke Pixabay: %d", got)
	}
}

// Tanpa kunci API fiturnya mati: daftar kosong, bukan galat, dan Pixabay
// tidak dihubungi.
func TestStockMediaWithoutKey(t *testing.T) {
	f := newFakePixabay(t)
	a := newStockApp(t, f, "")

	resp, out, raw := a.search(t, "kuliner")
	if resp.StatusCode != http.StatusOK || out.Configured || len(out.Data.Photos) != 0 || len(out.Data.Videos) != 0 {
		t.Errorf("tanpa kunci = %d %s", resp.StatusCode, raw)
	}
	if !strings.Contains(raw, `"photos":[]`) {
		t.Errorf("daftar kosong harus [] supaya layar tidak menerima null: %s", raw)
	}
	resp = do(t, a.h, call{method: http.MethodGet, path: "/v1/stock-media/photos/101/file", cookie: a.admin})
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("foto tanpa kunci = %d", resp.StatusCode)
	}
	if got := f.searches.Load(); got != 0 {
		t.Errorf("Pixabay dihubungi tanpa kunci: %d", got)
	}
}

// Foto diunduh server dari alamat di jawaban Pixabay, dan hanya dari Pixabay.
func TestStockMediaPhotoFile(t *testing.T) {
	f := newFakePixabay(t)
	a := newStockApp(t, f, "kunci")

	resp := do(t, a.h, call{method: http.MethodGet, path: "/v1/stock-media/photos/101/file", cookie: a.admin})
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK || string(body) != "isi-foto" || resp.Header.Get("Content-Type") != "image/jpeg" {
		t.Fatalf("berkas foto = %d %q %q", resp.StatusCode, resp.Header.Get("Content-Type"), body)
	}
	if resp.Header.Get("X-Content-Type-Options") != "nosniff" {
		t.Error("berkas dari luar harus dikirim dengan nosniff")
	}

	// Foto yang baru saja tampil di hasil pencarian diunduh tanpa bertanya lagi ke Pixabay.
	searched := newStockApp(t, f, "kunci")
	searched.search(t, "kuliner")
	before := f.searches.Load()
	resp = do(t, searched.h, call{method: http.MethodGet, path: "/v1/stock-media/photos/101/file", cookie: searched.admin})
	if resp.StatusCode != http.StatusOK || f.searches.Load() != before {
		t.Errorf("foto dari hasil pencarian = %d, permintaan tambahan ke Pixabay = %d", resp.StatusCode, f.searches.Load()-before)
	}

	// Jawaban yang menunjuk ke host lain tidak diikuti.
	elsewhere := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("server mengunduh dari host di luar Pixabay")
	}))
	t.Cleanup(elsewhere.Close)
	other := newStockApp(t, f, "kunci")
	f.photoHost.Store(elsewhere.URL)
	resp = do(t, other.h, call{method: http.MethodGet, path: "/v1/stock-media/photos/101/file", cookie: other.admin})
	if resp.StatusCode != http.StatusServiceUnavailable || errorCode(t, resp) != apperr.CodeStockMediaUnavailable {
		t.Errorf("alamat di luar Pixabay = %d", resp.StatusCode)
	}
}

// Pustaka media menelusuri foto per halaman. Jumlah halamannya dibatasi,
// supaya banyaknya permintaan berbeda ke Pixabay tetap terbatas.
func TestStockMediaPages(t *testing.T) {
	f := newFakePixabay(t)
	a := newStockApp(t, f, "kunci")
	page := func(query string) stockResponse {
		t.Helper()
		resp := do(t, a.h, call{method: http.MethodGet, path: "/v1/stock-media?category=kuliner" + query, cookie: a.admin})
		var out stockResponse
		if err := json.NewDecoder(resp.Body).Decode(&out); err != nil || resp.StatusCode != http.StatusOK {
			t.Fatalf("halaman %q = %d, %v", query, resp.StatusCode, err)
		}
		return out
	}

	first := page("")
	if first.Data.Page != 1 || !first.Data.HasMore || len(first.Data.Videos) != 1 {
		t.Errorf("halaman pertama = %+v", first.Data)
	}
	// Halaman berikutnya hanya foto: video tidak diminta lagi.
	before := f.searches.Load()
	second := page("&page=2")
	if got, _ := f.pages.Load().(string); second.Data.Page != 2 || got != "2" || len(second.Data.Videos) != 0 {
		t.Errorf("halaman kedua = %+v, page ke Pixabay = %q", second.Data, got)
	}
	if got := f.searches.Load() - before; got != 1 {
		t.Errorf("halaman kedua = %d permintaan ke Pixabay, want 1", got)
	}
	// 60 foto dengan 24 per halaman habis di halaman ketiga, yang juga halaman terakhir yang dilayani.
	if third := page("&page=3"); third.Data.Page != 3 || third.Data.HasMore {
		t.Errorf("halaman ketiga = %+v", third.Data)
	}
	// Halaman di luar rentang dan yang bukan angka dijawab halaman pertama, dari cache.
	before = f.searches.Load()
	if out := page("&page=99"); out.Data.Page != 1 {
		t.Errorf("page=99 dijawab halaman %d", out.Data.Page)
	}
	if out := page("&page=abc"); out.Data.Page != 1 {
		t.Errorf("page=abc dijawab halaman %d", out.Data.Page)
	}
	if got := f.searches.Load() - before; got != 0 {
		t.Errorf("halaman di luar rentang memicu %d permintaan ke Pixabay", got)
	}
}

// Pixabay yang sedang gagal dijawab 503, dan kegagalannya tidak ikut di-cache.
func TestStockMediaUpstreamFailureIsNotCached(t *testing.T) {
	f := newFakePixabay(t)
	a := newStockApp(t, f, "kunci")

	f.status.Store(http.StatusTooManyRequests)
	resp, _, _ := a.search(t, "kafe")
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("Pixabay gagal = %d, want 503", resp.StatusCode)
	}
	f.status.Store(http.StatusOK)
	resp, out, raw := a.search(t, "kafe")
	if resp.StatusCode != http.StatusOK || len(out.Data.Photos) != 1 {
		t.Errorf("sesudah pulih = %d %s", resp.StatusCode, raw)
	}
}
