package main

import (
	"context"
	"encoding/json"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/gonsutrijayautama/gonsu-appkit-go/media"
	"github.com/gonsutrijayautama/gonsu-one-sdk-go/web"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authz"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/config"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/entitlement"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/modules"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/testdb"
)

// fakeBucket adalah layanan S3 seperlunya di memori: satu bucket bernama
// "berkas". Bucket lain dijawab tidak ada.
type fakeBucket struct {
	mu      sync.Mutex
	objects map[string][]byte
}

func (f *fakeBucket) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	key, inBucket := strings.CutPrefix(r.URL.Path, "/berkas")
	if !inBucket {
		w.Header().Set("Content-Type", "application/xml")
		w.WriteHeader(http.StatusNotFound)
		_, _ = io.WriteString(w, `<Error><Code>NoSuchBucket</Code></Error>`)
		return
	}
	switch r.Method {
	case http.MethodHead:
	case http.MethodPut:
		body, _ := io.ReadAll(r.Body)
		f.objects[key] = body
	case http.MethodGet:
		body, ok := f.objects[key]
		if !ok {
			w.Header().Set("Content-Type", "application/xml")
			w.WriteHeader(http.StatusNotFound)
			_, _ = io.WriteString(w, `<Error><Code>NoSuchKey</Code></Error>`)
			return
		}
		_, _ = w.Write(body)
	case http.MethodDelete:
		delete(f.objects, key)
		w.WriteHeader(http.StatusNoContent)
	}
}

func (f *fakeBucket) len() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.objects)
}

func bucketConfig(endpoint, bucket string) config.ObjectStorage {
	return config.ObjectStorage{
		Endpoint: endpoint, Region: "auto", Bucket: bucket,
		AccessKeyID: "kunci", SecretAccessKey: "rahasia", PathStyle: true,
	}
}

// Tanpa konfigurasi penyimpanan objek, isi berkas media disimpan di database.
func TestMediaStoreDefaultsToDatabase(t *testing.T) {
	store, err := mediaStore(context.Background(), config.ObjectStorage{}, quiet)
	if err != nil || store != nil {
		t.Errorf("mediaStore tanpa konfigurasi = %v, %v; ingin nil, nil", store, err)
	}
}

// Bucket yang tidak terjangkau menggagalkan start, bukan unggahan pertama.
func TestMediaStoreChecksBucketAtStart(t *testing.T) {
	srv := httptest.NewServer(&fakeBucket{objects: map[string][]byte{}})
	defer srv.Close()

	if _, err := mediaStore(context.Background(), bucketConfig(srv.URL, "berkas"), quiet); err != nil {
		t.Errorf("bucket yang ada: %v", err)
	}
	_, err := mediaStore(context.Background(), bucketConfig(srv.URL, "tidak-ada"), quiet)
	if err == nil {
		t.Fatal("bucket yang tidak ada lolos")
	}
	if strings.Contains(err.Error(), "rahasia") {
		t.Errorf("galat memuat secret: %v", err)
	}
}

// Dengan penyimpanan objek dikonfigurasi, logo yang diunggah lewat API masuk ke
// bucket — bukan ke database — dan tetap disajikan di /media/{id} tanpa sesi.
func TestLogoOnObjectStorage(t *testing.T) {
	bucket := &fakeBucket{objects: map[string][]byte{}}
	srv := httptest.NewServer(bucket)
	defer srv.Close()

	pool := testdb.New(t)
	app := newAppWith(t, pool, config.Config{ObjectStorage: bucketConfig(srv.URL, "berkas")})
	_, a := testdb.Tenant(t, pool, authz.RoleAdministrator)
	admin := sessionFor(t, pool, a, time.Hour)
	logo := logoPNG(t)

	resp := do(t, app, call{method: http.MethodPut, path: "/v1/business-profile/logo", body: logo, cookie: admin,
		header: map[string]string{"Content-Type": "image/png"}})
	p := decodeProfile(t, resp)
	if resp.StatusCode != http.StatusOK || p.Logo == nil {
		t.Fatalf("unggah logo = %d, %+v", resp.StatusCode, p)
	}
	if bucket.len() != 1 {
		t.Errorf("isi di bucket = %d, ingin 1", bucket.len())
	}
	// Key-nya <organization>/<id berkas>, tanpa awalan: satu bucket hanya
	// dipakai satu pemasangan.
	wantPrefix := "/" + a.OrganizationID.String() + "/"
	for key := range bucket.objects {
		if !strings.HasPrefix(key, wantPrefix) {
			t.Errorf("key = %q, ingin berawalan %q", key, wantPrefix)
		}
	}
	var blobs int
	if err := pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM appkit_media_blobs`).Scan(&blobs); err != nil {
		t.Fatal(err)
	}
	if blobs != 0 {
		t.Errorf("isi di database = %d, ingin 0", blobs)
	}

	resp = do(t, app, call{method: http.MethodGet, path: p.Logo.URL})
	served, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK || string(served) != logo {
		t.Errorf("GET %s tanpa sesi = %d, %d byte", p.Logo.URL, resp.StatusCode, len(served))
	}

	// Menghapus logo menghapus isinya dari bucket.
	if resp := do(t, app, call{method: http.MethodDelete, path: "/v1/business-profile/logo", cookie: admin}); resp.StatusCode != http.StatusOK {
		t.Fatalf("hapus logo = %d", resp.StatusCode)
	}
	if bucket.len() != 0 {
		t.Errorf("isi di bucket setelah logo dihapus = %d", bucket.len())
	}
}

// limitOf adalah lisensi yang menjawab satu batas, dan mencatat key yang
// ditanyakan.
type limitOf struct {
	entitlement.Noop
	value     int64
	unlimited bool
	asked     *[]string
}

func (l limitOf) Limit(_ context.Context, key string) (int64, bool) {
	if l.asked != nil {
		*l.asked = append(*l.asked, key)
	}
	return l.value, l.unlimited
}

// Kuota hanya berlaku untuk bucket yang disediakan GONSU: mode cloud dengan
// penyimpanan objek aktif. Di keadaan lain hak pakainya TIDAK dibaca — paket
// yang tidak membawa storage.gb dijawab nol, dan nol menolak setiap unggahan.
func TestMediaQuotaAppliesOnlyToPlatformBucket(t *testing.T) {
	bucket := bucketConfig("https://s3.internal", "berkas")
	tests := []struct {
		name    string
		mode    web.Mode
		storage config.ObjectStorage
		applies bool
	}{
		{"cloud, bucket dari platform", web.ModeCloud, bucket, true},
		{"cloud, berkas di database", web.ModeCloud, config.ObjectStorage{}, false},
		{"self-host, berkas di database", web.ModeSelfHost, config.ObjectStorage{}, false},
		{"self-host, bucket milik pelanggan", web.ModeSelfHost, bucket, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var asked []string
			// Paket tanpa storage.gb: nol, bukan tanpa batas.
			quota := mediaQuota(tt.mode, tt.storage, limitOf{asked: &asked})
			if (quota != nil) != tt.applies {
				t.Fatalf("kuota berlaku = %v, ingin %v", quota != nil, tt.applies)
			}
			if !tt.applies {
				return
			}
			limit, err := quota(context.Background(), uuid.New())
			if err != nil || limit != 0 {
				t.Errorf("batas = %d, %v; ingin 0", limit, err)
			}
			if len(asked) != 1 || asked[0] != "storage.gb" {
				t.Errorf("hak pakai yang dibaca = %v, ingin storage.gb", asked)
			}
		})
	}
}

func TestMediaQuotaFromEntitlement(t *testing.T) {
	tests := []struct {
		name      string
		value     int64
		unlimited bool
		want      int64
	}{
		{"15 GB", 15, false, 15 << 30},
		{"1 GB = 1.073.741.824 byte", 1, false, 1_073_741_824},
		{"tanpa nilai: tanpa batas", 0, true, media.Unlimited},
		{"key tidak dibawa paket: nol", 0, false, 0},
		// Nilai negatif tidak boleh dibaca library sebagai tanpa batas.
		{"nilai negatif: nol", -3, false, 0},
		{"terlalu besar untuk dihitung dalam byte: tanpa batas", math.MaxInt64, false, media.Unlimited},
	}
	storage := bucketConfig("https://s3.internal", "berkas")
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			quota := mediaQuota(web.ModeCloud, storage, limitOf{value: tt.value, unlimited: tt.unlimited})
			got, err := quota(context.Background(), uuid.New())
			if err != nil || got != tt.want {
				t.Errorf("batas = %d, %v; ingin %d", got, err, tt.want)
			}
		})
	}
}

// Kuota yang penuh ditolak dengan galat yang sama dengan hak pakai lain —
// ENTITLEMENT_REQUIRED, menyebut storage.gb — supaya frontend menawarkan naik
// paket. Melewati batas tidak menghapus apa pun: yang sudah ada tetap tampil
// dan tetap dapat dihapus; hanya unggahan baru yang ditolak.
func TestStorageQuotaOverHTTP(t *testing.T) {
	pool := testdb.New(t)
	a, err := prepare(context.Background(), pool, config.Config{}, quiet)
	if err != nil {
		t.Fatal(err)
	}
	var limit atomic.Int64
	limit.Store(media.Unlimited)
	a.modules, err = modules.New(pool, a.org, quiet, modules.Options{
		MediaQuota: func(context.Context, uuid.UUID) (int64, error) { return limit.Load(), nil },
	})
	if err != nil {
		t.Fatal(err)
	}
	app := serve(t, a)
	_, admin := testdb.Tenant(t, pool, authz.RoleAdministrator)
	cookie := sessionFor(t, pool, admin, time.Hour)
	logo := logoPNG(t)
	upload := func() *http.Response {
		t.Helper()
		return do(t, app, call{method: http.MethodPut, path: "/v1/business-profile/logo", body: logo, cookie: cookie,
			header: map[string]string{"Content-Type": "image/png"}})
	}
	rejected := func(resp *http.Response, message string) {
		t.Helper()
		var env struct {
			Error struct {
				Code                string `json:"code"`
				Message             string `json:"message"`
				RequiredEntitlement string `json:"required_entitlement"`
			} `json:"error"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
			t.Fatalf("response bukan envelope galat: %v", err)
		}
		if resp.StatusCode != http.StatusForbidden || env.Error.Code != apperr.CodeEntitlementRequired ||
			env.Error.RequiredEntitlement != entitlement.StorageGB {
			t.Errorf("unggah melebihi kuota = %d %+v, ingin 403 ENTITLEMENT_REQUIRED storage.gb", resp.StatusCode, env.Error)
		}
		if !strings.Contains(env.Error.Message, message) {
			t.Errorf("pesan = %q, ingin memuat %q", env.Error.Message, message)
		}
	}

	resp := upload()
	p := decodeProfile(t, resp)
	if resp.StatusCode != http.StatusOK || p.Logo == nil {
		t.Fatalf("unggah logo = %d, %+v", resp.StatusCode, p)
	}

	// Kuota tepat sebesar logo yang ada: menggantinya dengan yang seukuran
	// masih boleh, karena logo lama dihapus.
	limit.Store(int64(len(logo)))
	resp = upload()
	if p = decodeProfile(t, resp); resp.StatusCode != http.StatusOK || p.Logo == nil {
		t.Fatalf("mengganti logo saat kuota penuh = %d", resp.StatusCode)
	}

	// Paket turun di bawah pemakaian: unggahan baru ditolak...
	limit.Store(8)
	rejected(upload(), "Penyimpanan penuh")
	// ...tetapi berkas yang ada tetap tampil, dan tetap dapat dihapus.
	if resp := do(t, app, call{method: http.MethodGet, path: p.Logo.URL}); resp.StatusCode != http.StatusOK {
		t.Errorf("GET %s saat melebihi kuota = %d, ingin 200", p.Logo.URL, resp.StatusCode)
	}
	if resp := do(t, app, call{method: http.MethodDelete, path: "/v1/business-profile/logo", cookie: cookie}); resp.StatusCode != http.StatusOK {
		t.Errorf("hapus logo saat melebihi kuota = %d, ingin 200", resp.StatusCode)
	}

	// Paket tanpa storage.gb: nol, tidak boleh menyimpan sama sekali.
	limit.Store(0)
	rejected(upload(), "tidak menyertakan penyimpanan")
}
