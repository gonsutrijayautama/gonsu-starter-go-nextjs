package main

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authz"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/config"
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

func bucketConfig(endpoint, bucket string) config.MediaStorage {
	return config.MediaStorage{
		Endpoint: endpoint, Region: "auto", Bucket: bucket,
		AccessKeyID: "kunci", SecretAccessKey: "rahasia", PathStyle: true,
	}
}

// Tanpa konfigurasi object storage, isi berkas media disimpan di database.
func TestMediaStoreDefaultsToDatabase(t *testing.T) {
	store, err := mediaStore(context.Background(), config.MediaStorage{}, quiet)
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

// Dengan object storage dikonfigurasi, logo yang diunggah lewat API masuk ke
// bucket — bukan ke database — dan tetap disajikan di /media/{id} tanpa sesi.
func TestLogoOnObjectStorage(t *testing.T) {
	bucket := &fakeBucket{objects: map[string][]byte{}}
	srv := httptest.NewServer(bucket)
	defer srv.Close()

	pool := testdb.New(t)
	storage := bucketConfig(srv.URL, "berkas")
	storage.Prefix = "aplikasi/"
	app := newAppWith(t, pool, config.Config{MediaStorage: storage})
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
	// Key-nya <awalan><organization>/<id berkas>.
	wantPrefix := "/aplikasi/" + a.OrganizationID.String() + "/"
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
