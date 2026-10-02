package main

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/gonsutrijayautama/gonsu-appkit-go/media"
	"github.com/gonsutrijayautama/gonsu-appkit-go/media/s3store"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/config"
)

// mediaStore memilih penyimpanan isi berkas media: bucket pemasangan ini bila
// penyimpanan objek dikonfigurasi (STORAGE_*), nil — database — bila tidak.
//
// Bucket yang tidak terjangkau menggagalkan start. Salah alamat atau salah
// kredensial harus ketahuan di sini, bukan saat pengguna pertama mengunggah
// logo.
func mediaStore(ctx context.Context, cfg config.ObjectStorage, logger *slog.Logger) (media.Store, error) {
	if !cfg.Configured() {
		return nil, nil
	}
	store, err := s3store.New(s3store.Options{
		Endpoint:        cfg.Endpoint,
		Region:          cfg.Region,
		Bucket:          cfg.Bucket,
		AccessKeyID:     cfg.AccessKeyID,
		SecretAccessKey: cfg.SecretAccessKey,
		PathStyle:       cfg.PathStyle,
	})
	if err != nil {
		return nil, fmt.Errorf("penyimpanan objek: %w", err)
	}
	checkCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	if err := store.Check(checkCtx); err != nil {
		return nil, fmt.Errorf("penyimpanan objek: %w", err)
	}
	logger.Info("isi berkas media disimpan di penyimpanan objek", slog.String("bucket", store.String()))
	return store, nil
}
