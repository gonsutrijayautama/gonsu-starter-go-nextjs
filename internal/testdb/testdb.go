// Package testdb menyiapkan PostgreSQL sekali pakai untuk integration test.
// Hanya dipakai berkas _test.go.
//
// Test di-skip bila TEST_DATABASE_URL kosong; `make test` mengisinya dengan
// database compose.dev.yaml, dan CI dengan service container.
package testdb

import (
	"context"
	"crypto/rand"
	"io"
	"log/slog"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	appkit "github.com/gonsutrijayautama/gonsu-appkit-go"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authn"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/storage"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/migrations"
)

// New membuat database kosong, menjalankan seluruh migrasi, dan
// mengembalikan pool-nya. Database dihapus saat test selesai.
func New(t *testing.T) *pgxpool.Pool {
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

	connectCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	pool, err := storage.Connect(connectCtx, u.String())
	if err != nil {
		t.Fatalf("Connect: %v", err)
	}
	t.Cleanup(pool.Close)

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	// Urutan yang sama dengan cmd/api: modul standar dulu, lalu produk.
	if err := appkit.Migrate(ctx, pool, logger); err != nil {
		t.Fatalf("Migrate modul standar: %v", err)
	}
	if err := storage.Migrate(ctx, pool, migrations.FS, logger); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	return pool
}

// Tenant membuat organization baru dengan satu pengguna ber-role role, lalu
// mengembalikan context yang membawa sesinya.
func Tenant(t *testing.T, pool *pgxpool.Pool, role string) (context.Context, authn.Principal) {
	t.Helper()
	return User(t, pool, uuid.New(), role)
}

// User menambah pengguna ber-role role di organization org.
func User(t *testing.T, pool *pgxpool.Pool, org uuid.UUID, role string) (context.Context, authn.Principal) {
	t.Helper()
	p := authn.Principal{OrganizationID: org, Role: role, Name: "Test " + role}
	err := pool.QueryRow(context.Background(), `
		INSERT INTO application_users (organization_id, external_subject, name, application_role)
		VALUES ($1, $2, $3, $4) RETURNING id`,
		org, "test:"+role+":"+rand.Text(), p.Name, role).Scan(&p.UserID)
	if err != nil {
		t.Fatalf("membuat pengguna %s: %v", role, err)
	}
	return authn.WithPrincipal(context.Background(), p), p
}
