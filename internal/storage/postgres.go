// Package storage memegang koneksi PostgreSQL dan menjalankan migrasi.
package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Connect membuka pool dan menunggu database menjawab.
//
// Database yang belum siap ketika container start adalah keadaan biasa —
// compose yang baru naik, atau database dan aplikasi yang restart bersamaan —
// jadi Connect mencoba ulang sampai ctx habis, bukan menyerah pada percobaan
// pertama. Batas waktunya ditentukan pemanggil.
func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		// pgx menyamarkan sandi pada pesan galatnya sendiri.
		return nil, fmt.Errorf("DATABASE_URL tidak dapat dibaca: %w", err)
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("membuat pool database: %w", err)
	}

	delay := 250 * time.Millisecond
	for {
		err := pool.Ping(ctx)
		if err == nil {
			return pool, nil
		}
		select {
		case <-ctx.Done():
			pool.Close()
			return nil, fmt.Errorf("database tidak terjangkau (%s:%d): %w", cfg.ConnConfig.Host, cfg.ConnConfig.Port, err)
		case <-time.After(delay):
		}
		delay = min(delay*2, 5*time.Second)
	}
}
