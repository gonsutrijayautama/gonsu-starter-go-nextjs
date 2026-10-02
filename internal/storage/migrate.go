package storage

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/pressly/goose/v3/lock"
)

// Waktu tunggu lock migrasi, diturunkan dari probe chart GONSU
// (`deploy/helm/product/values.yaml`: initialDelaySeconds 2, periodSeconds 5;
// liveness mulai 5 detik lebih lambat, failureThreshold bawaan Kubernetes 3).
//
// Liveness karena itu membunuh pod sekitar detik ke-17 setelah container
// start. Replica yang menunggu lock harus MENYERAH SEBELUM ITU, supaya
// kegagalannya menjadi pesan yang menyebut sebabnya alih-alih pod yang mati
// tanpa keterangan. Startup berikutnya mencoba lagi, dan saat itu migrasinya
// sudah selesai dikerjakan replica yang memegang lock.
const (
	lockRetryInterval  = time.Second
	lockRetryThreshold = 12
)

// Migrate menerapkan seluruh migrasi yang belum diterapkan, di bawah lock
// yang dipegang di tabel.
//
// GONSU tidak memigrasikan skema produk; produk melakukannya sendiri saat
// start, sebelum menerima trafik. Beberapa replica dapat start bersamaan: satu
// memegang lock dan bermigrasi, sisanya menunggu lalu mendapati tidak ada lagi
// yang perlu diterapkan.
//
// LOCK-NYA BERBASIS TABEL, BUKAN ADVISORY LOCK TINGKAT SESI. Database
// pelanggan berada di belakang PgBouncer dengan `pool_mode=transaction`:
// koneksi server dikembalikan ke pool pada akhir tiap
// transaksi, sehingga `pg_advisory_lock` yang diambil di luar transaksi dapat
// dilepas pada koneksi server yang berbeda — lock-nya tidak menjaga apa pun,
// dan gejalanya tidak menyebut PgBouncer sama sekali. Lock berbasis tabel
// memakai transaksi tersendiri untuk tiap operasinya, plus lease dan
// heartbeat, sehingga aman di belakang pooler.
//
// Migrasi yang gagal mengembalikan galat dan pemanggil wajib menghentikan
// startup — aplikasi tidak pernah melayani di atas skema setengah jadi.
func Migrate(ctx context.Context, pool *pgxpool.Pool, migrations fs.FS, logger *slog.Logger) error {
	locker, err := lock.NewPostgresTableLocker(
		lock.WithTableLockTimeout(lockRetryInterval, lockRetryThreshold),
		// Lease lebih panjang daripada waktu tunggu: pemegang lock yang
		// prosesnya mati tidak boleh menahan lock selamanya, tetapi juga tidak
		// boleh kehilangannya di tengah migrasi yang masih berjalan.
		lock.WithTableLeaseDuration(30*time.Second),
		lock.WithTableHeartbeatInterval(5*time.Second),
	)
	if err != nil {
		return fmt.Errorf("menyiapkan lock migrasi: %w", err)
	}

	// Menutup db ini tidak menutup pool.
	db := stdlib.OpenDBFromPool(pool)
	defer db.Close()

	provider, err := goose.NewProvider(goose.DialectPostgres, db, migrations,
		goose.WithLocker(locker))
	if err != nil {
		return fmt.Errorf("menyiapkan migrasi: %w", err)
	}

	results, err := provider.Up(ctx)
	if partial, ok := errors.AsType[*goose.PartialError](err); ok {
		// goose hanya menyebut nomor versi; operator butuh nama berkasnya.
		return fmt.Errorf("migrasi %s gagal, aplikasi tidak dijalankan: %w",
			partial.Failed.Source.Path, partial.Err)
	}
	if err != nil {
		return fmt.Errorf("migrasi gagal, aplikasi tidak dijalankan: %w", err)
	}
	for _, r := range results {
		logger.InfoContext(ctx, "migrasi diterapkan",
			slog.Int64("version", r.Source.Version),
			slog.String("file", r.Source.Path),
			slog.Float64("duration_ms", float64(r.Duration.Microseconds())/1000))
	}
	if len(results) == 0 {
		logger.InfoContext(ctx, "skema sudah terbaru")
	}
	return nil
}
