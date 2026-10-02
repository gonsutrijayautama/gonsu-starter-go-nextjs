// Command api adalah satu-satunya proses produk: satu binary yang menjalankan
// migrasi saat start, lalu menyajikan API dan frontend di :8080.
//
//	produk-contoh                  migrasi, lalu melayani
//	produk-contoh migrate          migrasi saja, lalu keluar
//	produk-contoh users <perintah> pemberian akses login oleh operator
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	appkit "github.com/gonsutrijayautama/gonsu-appkit-go"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authn"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/config"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/httpx"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/storage"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/migrations"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/web"
)

// addr adalah kontrak dengan chart GONSU, bukan konfigurasi.
// Tidak ada environment yang mengubahnya di build rilis; produk yang
// menyesuaikan diri. Build `dev` boleh mendengar di alamat lain (listenAddr),
// karena :8080 di laptop sering sudah dipakai.
const addr = ":8080"

// version diisi saat build: -ldflags "-X main.version=...".
var version = "dev"

func main() {
	// Perintah `users` menulis hasilnya ke stdout untuk dibaca operator; log
	// dipindah ke stderr supaya keduanya tidak bercampur.
	logOut := os.Stdout
	if len(os.Args) > 1 && os.Args[1] == "users" {
		logOut = os.Stderr
	}
	logger := slog.New(slog.NewJSONHandler(logOut, nil))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := run(ctx, os.Args[1:], logger); err != nil {
		logger.Error("berhenti", slog.String("error", err.Error()))
		os.Exit(1)
	}
}

func run(ctx context.Context, args []string, logger *slog.Logger) error {
	migrateOnly := false
	var users *usersCommand
	switch {
	case len(args) == 0:
	case len(args) == 1 && args[0] == "migrate":
		migrateOnly = true
	case len(args) >= 1 && args[0] == "users":
		// Diurai sebelum database disentuh: salah ketik perintah tidak perlu
		// menunggu koneksi.
		cmd, err := parseUsers(args[1:])
		if err != nil {
			return err
		}
		users = &cmd
	default:
		return fmt.Errorf("argumen tidak dikenal %q; yang tersedia: migrate, users", strings.Join(args, " "))
	}

	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return err
	}
	logger.Info("mulai", slog.String("version", version))

	connectCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	pool, err := storage.Connect(connectCtx, cfg.DatabaseURL)
	cancel()
	if err != nil {
		return err
	}
	defer pool.Close()

	// Sebelum port dibuka: selama migrasi berjalan, probe gagal terhubung dan
	// pod belum menerima trafik — persis yang diinginkan.
	//
	// Migrasi modul standar (tabel appkit_*) lebih dulu: tabel produk boleh
	// merujuk tabel library, tidak pernah sebaliknya.
	if err := appkit.Migrate(ctx, pool, logger); err != nil {
		return err
	}
	if err := storage.Migrate(ctx, pool, migrations.FS, logger); err != nil {
		return err
	}
	if migrateOnly {
		return nil
	}

	a, err := prepare(ctx, pool, cfg, logger)
	if err != nil {
		return err
	}
	if users != nil {
		return users.run(ctx, a, os.Stdout)
	}
	routes, err := a.routes()
	if err != nil {
		return err
	}
	logger.Info("pemasangan siap",
		slog.String("organization_id", a.org.String()),
		slog.String("mode", string(a.kit.Mode())),
		slog.Bool("login_gonsu", a.gonsuLogin))
	if authn.DevLoginEnabled() {
		logger.Warn("BUILD PENGEMBANGAN: login pengembangan aktif di /auth/login. Binary ini tidak boleh dirilis.")
	}

	listen := listenAddr()
	ln, err := net.Listen("tcp", listen)
	if err != nil {
		return fmt.Errorf("membuka %s: %w", listen, err)
	}
	srv := &http.Server{
		Handler: httpx.NewRouter(httpx.Options{
			Version:  version,
			Frontend: web.FS(),
			Logger:   logger,
			Routes:   routes,
		}),
		ReadHeaderTimeout: 10 * time.Second,
	}

	// Lisensi cloud: aktivasi pertama, lalu heartbeat, sampai ctx selesai. Di
	// self-host agent yang mengerjakannya, dan Run hanya menunggu.
	// Konteksnya sendiri: server yang berhenti karena galat tidak membatalkan
	// ctx, dan Run harus ikut berhenti juga saat itu.
	licenseCtx, stopLicense := context.WithCancel(ctx)
	licenseDone := make(chan struct{})
	go func() {
		defer close(licenseDone)
		a.kit.Run(licenseCtx)
	}()
	defer func() {
		stopLicense()
		<-licenseDone
	}()

	serveErr := make(chan error, 1)
	go func() { serveErr <- srv.Serve(ln) }()
	logger.Info("melayani", slog.String("addr", listen))

	select {
	case err := <-serveErr:
		return fmt.Errorf("server berhenti: %w", err)
	case <-ctx.Done():
	}

	logger.Info("menerima sinyal berhenti, menyelesaikan permintaan yang berjalan")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("menghentikan server: %w", err)
	}
	return nil
}
