package storage

import (
	"context"
	"crypto/rand"
	"io"
	"log/slog"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"testing/fstest"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/migrations"
)

var discard = slog.New(slog.NewTextHandler(io.Discard, nil))

// newTestDatabase membuat database kosong sekali pakai dan mengembalikan
// URL-nya. Test di-skip bila TEST_DATABASE_URL tidak diisi (`make test`
// mengisinya dengan database compose.dev.yaml).
func newTestDatabase(t *testing.T) string {
	t.Helper()
	adminURL := os.Getenv("TEST_DATABASE_URL")
	if adminURL == "" {
		t.Skip("TEST_DATABASE_URL kosong; jalankan lewat `make test`")
	}
	ctx := context.Background()

	admin, err := pgxpool.New(ctx, adminURL)
	if err != nil {
		t.Fatalf("koneksi admin: %v", err)
	}
	t.Cleanup(admin.Close)

	name := "app_test_" + strings.ToLower(rand.Text())
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+name); err != nil {
		t.Fatalf("CREATE DATABASE: %v", err)
	}
	t.Cleanup(func() {
		if _, err := admin.Exec(context.Background(), "DROP DATABASE "+name+" WITH (FORCE)"); err != nil {
			t.Errorf("DROP DATABASE %s: %v", name, err)
		}
	})

	u, err := url.Parse(adminURL)
	if err != nil {
		t.Fatalf("TEST_DATABASE_URL harus berbentuk URL: %v", err)
	}
	u.Path = "/" + name
	return u.String()
}

func connect(t *testing.T, databaseURL string) *pgxpool.Pool {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	pool, err := Connect(ctx, databaseURL)
	if err != nil {
		t.Fatalf("Connect: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func appliedVersions(t *testing.T, pool *pgxpool.Pool) []int64 {
	t.Helper()
	rows, err := pool.Query(context.Background(),
		"SELECT version_id FROM goose_db_version WHERE version_id > 0 ORDER BY id")
	if err != nil {
		t.Fatalf("membaca goose_db_version: %v", err)
	}
	defer rows.Close()
	var versions []int64
	for rows.Next() {
		var v int64
		if err := rows.Scan(&v); err != nil {
			t.Fatal(err)
		}
		versions = append(versions, v)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return versions
}

func TestMigrateRealMigrationsIsIdempotent(t *testing.T) {
	pool := connect(t, newTestDatabase(t))
	ctx := context.Background()

	for i := range 2 {
		if err := Migrate(ctx, pool, migrations.FS, discard); err != nil {
			t.Fatalf("Migrate ke-%d: %v", i+1, err)
		}
	}
	if got := appliedVersions(t, pool); len(got) == 0 || got[0] != 1 {
		t.Fatalf("versi yang tercatat = %v, want diawali 1", got)
	}
}

// Rilis baru pada aplikasi yang sudah berjalan: beberapa replica start
// bersamaan di atas database yang sudah punya skema, dan semuanya melihat satu
// migrasi baru. Migrasi itu gagal bila diterapkan dua kali, jadi tanpa advisory
// lock test ini gagal dengan "relation already exists".
//
// Database sengaja dimigrasikan dulu sekali. Pada database yang masih kosong,
// goose mencoba ulang pembuatan tabel versinya dengan jeda satu detik, dan jeda
// itu kebetulan menyerialkan replica — test akan lulus meski lock dicabut.
func TestMigrateConcurrentReplicasApplyOnce(t *testing.T) {
	databaseURL := newTestDatabase(t)
	base := fstest.MapFS{
		"00001_base.sql": {Data: []byte("-- +goose Up\nSELECT 1;\n-- +goose Down\nSELECT 1;\n")},
	}
	if err := Migrate(context.Background(), connect(t, databaseURL), base, discard); err != nil {
		t.Fatalf("migrasi awal: %v", err)
	}

	release := fstest.MapFS{
		"00001_base.sql": base["00001_base.sql"],
		"00002_probe.sql": {Data: []byte(`-- +goose Up
CREATE TABLE replica_probe (id int);
SELECT pg_sleep(0.3);
-- +goose Down
DROP TABLE replica_probe;
`)},
	}

	const replicas = 5
	pools := make([]*pgxpool.Pool, replicas)
	for i := range pools {
		pools[i] = connect(t, databaseURL)
	}

	var wg sync.WaitGroup
	errs := make([]error, replicas)
	for i, pool := range pools {
		wg.Go(func() {
			errs[i] = Migrate(context.Background(), pool, release, discard)
		})
	}
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Errorf("replica %d: %v", i, err)
		}
	}
	if got := appliedVersions(t, pools[0]); len(got) != 2 || got[1] != 2 {
		t.Fatalf("versi yang tercatat = %v, want tepat [1 2]", got)
	}
}

// Migrasi yang gagal harus menghentikan startup dan tidak meninggalkan
// sebagian perubahannya.
func TestMigrateFailureLeavesNoHalfAppliedSchema(t *testing.T) {
	pool := connect(t, newTestDatabase(t))
	fsys := fstest.MapFS{
		"00001_broken.sql": {Data: []byte(`-- +goose Up
CREATE TABLE half_applied (id int);
SELECT * FROM tabel_yang_tidak_ada;
-- +goose Down
DROP TABLE half_applied;
`)},
	}

	err := Migrate(context.Background(), pool, fsys, discard)
	if err == nil {
		t.Fatal("Migrate berhasil, padahal migrasinya rusak")
	}
	if !strings.Contains(err.Error(), "00001_broken.sql") {
		t.Errorf("pesan galat tidak menyebut berkasnya: %v", err)
	}

	var exists bool
	if err := pool.QueryRow(context.Background(),
		"SELECT to_regclass('half_applied') IS NOT NULL").Scan(&exists); err != nil {
		t.Fatal(err)
	}
	if exists {
		t.Error("tabel half_applied tertinggal: migrasi yang gagal meninggalkan skema setengah jadi")
	}
}

// Perilaku yang sebenarnya dipakai production: database di belakang PgBouncer
// dengan `pool_mode=transaction`.
//
// Ini test yang benar-benar membuktikan lock migrasi. Lock ADVISORY TINGKAT
// SESI lolos pada test konkuren di atas — yang berbicara langsung ke
// PostgreSQL — dan gagal di sini, karena koneksi server dikembalikan ke pool
// pada akhir tiap transaksi sehingga lock dan unlock-nya dapat mendarat di
// koneksi yang berbeda.
//
// Dijalankan lewat `make test-pgbouncer`; dilewati bila TEST_PGBOUNCER_URL
// kosong, supaya `make test` biasa tidak menuntut pooler.
func TestMigrateConcurrentReplicasThroughPooler(t *testing.T) {
	poolerURL := os.Getenv("TEST_PGBOUNCER_URL")
	if poolerURL == "" {
		t.Skip("TEST_PGBOUNCER_URL kosong; jalankan lewat `make test-pgbouncer`")
	}
	// Databasenya dibuat lewat jalur langsung (PgBouncer tidak melayani
	// CREATE DATABASE), lalu dimigrasikan lewat pooler.
	databaseURL := newTestDatabase(t)
	name := databaseURL[strings.LastIndex(databaseURL, "/")+1:]
	if i := strings.Index(name, "?"); i >= 0 {
		name = name[:i]
	}
	throughPooler := replaceDatabase(t, poolerURL, name)

	base := fstest.MapFS{
		"00001_base.sql": {Data: []byte("-- +goose Up\nSELECT 1;\n-- +goose Down\nSELECT 1;\n")},
	}
	if err := Migrate(context.Background(), connect(t, throughPooler), base, discard); err != nil {
		t.Fatalf("migrasi awal lewat pooler: %v", err)
	}

	release := fstest.MapFS{
		"00001_base.sql": base["00001_base.sql"],
		"00002_probe.sql": {Data: []byte(`-- +goose Up
CREATE TABLE pooler_probe (id int);
SELECT pg_sleep(0.3);
-- +goose Down
DROP TABLE pooler_probe;
`)},
	}

	const replicas = 3
	var wg sync.WaitGroup
	errs := make([]error, replicas)
	for i := range replicas {
		pool := connect(t, throughPooler)
		wg.Go(func() {
			errs[i] = Migrate(context.Background(), pool, release, discard)
		})
	}
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Errorf("replica %d lewat pooler: %v", i, err)
		}
	}
	// Tabelnya dibuat tepat sekali; migrasi kedua yang lolos lock akan gagal
	// dengan "relation already exists".
	var tables int
	if err := connect(t, throughPooler).QueryRow(context.Background(),
		"SELECT count(*) FROM pg_tables WHERE tablename = 'pooler_probe'").Scan(&tables); err != nil {
		t.Fatal(err)
	}
	if tables != 1 {
		t.Errorf("tabel pooler_probe = %d, ingin tepat 1", tables)
	}
}

// replaceDatabase mengganti nama database pada URL pooler.
func replaceDatabase(t *testing.T, rawURL, name string) string {
	t.Helper()
	u, err := url.Parse(rawURL)
	if err != nil {
		t.Fatalf("URL pooler: %v", err)
	}
	u.Path = "/" + name
	return u.String()
}
