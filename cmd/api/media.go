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

// mediaStore memilih penyimpanan isi berkas media: bucket S3 bila
// dikonfigurasi, nil — database — bila tidak.
//
// Bucket yang tidak terjangkau menggagalkan start. Salah alamat atau salah
// kredensial harus ketahuan di sini, bukan saat pengguna pertama mengunggah
// logo.
func mediaStore(ctx context.Context, cfg config.MediaStorage, logger *slog.Logger) (media.Store, error) {
	if !cfg.Configured() {
		return nil, nil
	}
	store, err := s3store.New(s3store.Options{
		Endpoint:        cfg.Endpoint,
		Region:          cfg.Region,
		Bucket:          cfg.Bucket,
		AccessKeyID:     cfg.AccessKeyID,
		SecretAccessKey: cfg.SecretAccessKey,
		Prefix:          cfg.Prefix,
		PathStyle:       cfg.PathStyle,
	})
	if err != nil {
		return nil, fmt.Errorf("object storage media: %w", err)
	}
	checkCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	if err := store.Check(checkCtx); err != nil {
		return nil, fmt.Errorf("object storage media: %w", err)
	}
	logger.Info("isi berkas media disimpan di object storage", slog.String("bucket", store.String()))
	return store, nil
}
