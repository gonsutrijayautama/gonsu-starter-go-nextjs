package config

import (
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

func env(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

func TestLoadDatabaseURL(t *testing.T) {
	tests := []struct {
		name string
		env  map[string]string
		want string
	}{
		{
			name: "DATABASE_URL dipakai apa adanya",
			env:  map[string]string{"DATABASE_URL": "postgres://u:p@db:5432/app?sslmode=require"},
			want: "postgres://u:p@db:5432/app?sslmode=require",
		},
		{
			name: "DATABASE_URL menang atas variabel terpisah",
			env: map[string]string{
				"DATABASE_URL":  "postgres://u:p@db:5432/app",
				"DATABASE_HOST": "lain",
				"DATABASE_NAME": "lain",
				"DATABASE_USER": "lain",
			},
			want: "postgres://u:p@db:5432/app",
		},
		{
			name: "baris baru dari berkas secret dibuang",
			env:  map[string]string{"DATABASE_URL": "postgres://u:p@db/app\n"},
			want: "postgres://u:p@db/app",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg, err := Load(env(tt.env))
			if err != nil {
				t.Fatalf("Load: %v", err)
			}
			if cfg.DatabaseURL != tt.want {
				t.Errorf("DatabaseURL = %q, want %q", cfg.DatabaseURL, tt.want)
			}
		})
	}
}

// URL yang disusun harus dibaca pgx persis seperti nilai aslinya — termasuk
// sandi dengan karakter yang punya arti di URL.
func TestLoadFromPartsIsReadableByPgx(t *testing.T) {
	tests := []struct {
		name     string
		env      map[string]string
		host     string
		port     uint16
		password string
	}{
		{
			name: "lengkap dengan sandi berkarakter khusus",
			env: map[string]string{
				"DATABASE_HOST":     "db.internal",
				"DATABASE_PORT":     "6543",
				"DATABASE_NAME":     "app",
				"DATABASE_USER":     "app",
				"DATABASE_PASSWORD": "p@ss:w/rd?#% x",
			},
			host:     "db.internal",
			port:     6543,
			password: "p@ss:w/rd?#% x",
		},
		{
			name: "port bawaan 5432",
			env: map[string]string{
				"DATABASE_HOST":     "db",
				"DATABASE_NAME":     "app",
				"DATABASE_USER":     "app",
				"DATABASE_PASSWORD": "rahasia",
			},
			host:     "db",
			port:     5432,
			password: "rahasia",
		},
		{
			name: "host IPv6",
			env: map[string]string{
				"DATABASE_HOST": "::1",
				"DATABASE_NAME": "app",
				"DATABASE_USER": "app",
			},
			host: "::1",
			port: 5432,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg, err := Load(env(tt.env))
			if err != nil {
				t.Fatalf("Load: %v", err)
			}
			pc, err := pgconn.ParseConfig(cfg.DatabaseURL)
			if err != nil {
				t.Fatalf("pgx tidak dapat membaca %q: %v", cfg.DatabaseURL, err)
			}
			if pc.Host != tt.host || pc.Port != tt.port {
				t.Errorf("host:port = %s:%d, want %s:%d", pc.Host, pc.Port, tt.host, tt.port)
			}
			if pc.Database != tt.env["DATABASE_NAME"] || pc.User != tt.env["DATABASE_USER"] {
				t.Errorf("database/user = %s/%s", pc.Database, pc.User)
			}
			if pc.Password != tt.password {
				t.Errorf("password = %q, want %q", pc.Password, tt.password)
			}
		})
	}
}

func TestLoadRejectsIncompleteConfig(t *testing.T) {
	tests := []struct {
		name    string
		env     map[string]string
		mention []string
	}{
		{
			name:    "tidak ada apa pun",
			env:     map[string]string{},
			mention: []string{"DATABASE_URL"},
		},
		{
			name: "variabel terpisah tidak lengkap",
			env: map[string]string{
				"DATABASE_HOST":     "db",
				"DATABASE_PASSWORD": "jangan-bocor",
			},
			mention: []string{"DATABASE_NAME", "DATABASE_USER"},
		},
		{
			name: "port bukan angka",
			env: map[string]string{
				"DATABASE_HOST":     "db",
				"DATABASE_PORT":     "lima",
				"DATABASE_NAME":     "app",
				"DATABASE_USER":     "app",
				"DATABASE_PASSWORD": "jangan-bocor",
			},
			mention: []string{"DATABASE_PORT"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Load(env(tt.env))
			if err == nil {
				t.Fatal("Load berhasil, padahal konfigurasi tidak lengkap")
			}
			for _, m := range tt.mention {
				if !strings.Contains(err.Error(), m) {
					t.Errorf("pesan %q tidak menyebut %s", err, m)
				}
			}
			if strings.Contains(err.Error(), "jangan-bocor") {
				t.Errorf("pesan galat memuat sandi: %q", err)
			}
		})
	}
}

const dbOnly = "postgres://u:p@db/app"

// Variabel GONSU dinilai kit, bukan di sini: Load hanya
// meneruskannya, ditambah jeda pemeriksaan ulang sesi yang produk butuhkan
// sendiri.
func TestLoadPassesGonsuToKit(t *testing.T) {
	cfg, err := Load(env(map[string]string{
		"DATABASE_URL":               dbOnly,
		"GONSU_OIDC_ISSUER":          "https://id.gonsu.id/oidc",
		"GONSU_OIDC_RECHECK_SECONDS": "900",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Getenv == nil || cfg.Getenv("GONSU_OIDC_ISSUER") != "https://id.gonsu.id/oidc" {
		t.Error("variabel GONSU tidak diteruskan ke kit")
	}
	if cfg.OIDCRecheck != 15*time.Minute {
		t.Errorf("recheck = %v", cfg.OIDCRecheck)
	}
	if _, err := Load(env(map[string]string{"DATABASE_URL": dbOnly, "GONSU_OIDC_RECHECK_SECONDS": "15m"})); err == nil ||
		!strings.Contains(err.Error(), "GONSU_OIDC_RECHECK_SECONDS") {
		t.Errorf("recheck bukan angka: err = %v", err)
	}
}

// Build dev mendahulukan GONSU di /auth/login hanya bila pemasangan ini diberi
// login GONSU.
func TestGonsuLoginConfigured(t *testing.T) {
	tests := []struct {
		name string
		env  map[string]string
		want bool
	}{
		{"cloud", map[string]string{"GONSU_OIDC_ISSUER": "https://id.gonsu.id/oidc"}, true},
		{"self-host", map[string]string{"GONSU_AGENT_URL": "http://agent:8099"}, true},
		{"self-host nama lama", map[string]string{"GONSU_LICENSE_URL": "http://agent:8099/v1/license"}, true},
		{"tanpa GONSU", map[string]string{}, false},
		{"hanya spasi", map[string]string{"GONSU_OIDC_ISSUER": "  "}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.env["DATABASE_URL"] = dbOnly
			cfg, err := Load(env(tt.env))
			if err != nil {
				t.Fatal(err)
			}
			if got := cfg.GonsuLoginConfigured(); got != tt.want {
				t.Errorf("GonsuLoginConfigured = %v, want %v", got, tt.want)
			}
		})
	}
	if (Config{}).GonsuLoginConfigured() {
		t.Error("Config tanpa Getenv mengaku diberi login GONSU")
	}
}
