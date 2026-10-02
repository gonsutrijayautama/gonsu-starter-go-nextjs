package main

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"time"

	"github.com/google/uuid"

	"github.com/gonsutrijayautama/gonsu-appkit-go/media"
	"github.com/gonsutrijayautama/gonsu-appkit-go/media/s3store"
	"github.com/gonsutrijayautama/gonsu-one-sdk-go/web"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/config"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/entitlement"
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

// mediaQuota mengembalikan batas total penyimpanan berkas pemasangan ini dari
// hak pakai storage.gb, atau nil — tanpa batas — bila kuota tidak berlaku.
//
// Kuota HANYA berlaku untuk bucket yang disediakan GONSU: mode cloud dengan
// penyimpanan objek aktif. Di dua keadaan lain hak pakainya tidak dibaca sama
// sekali, karena paket yang tidak membawa storage.gb dijawab nol dan nol
// menolak setiap unggahan:
//
//   - berkas di database (self-host, atau cloud sebelum GONSU menyediakan
//     bucket): disknya milik pemasangan itu sendiri;
//   - self-host dengan penyimpanan S3 milik pelanggan: GONSU tidak
//     menyediakan, tidak mengukur, dan tidak membatasinya.
func mediaQuota(mode web.Mode, storage config.ObjectStorage, license entitlement.Resolver) func(context.Context, uuid.UUID) (int64, error) {
	if mode != web.ModeCloud || !storage.Configured() {
		return nil
	}
	return func(ctx context.Context, _ uuid.UUID) (int64, error) {
		gb, unlimited := license.Limit(ctx, entitlement.StorageGB)
		switch {
		case unlimited, gb > math.MaxInt64>>30:
			return media.Unlimited, nil
		case gb <= 0:
			// Paket tidak membawa storage.gb. Nilai negatif tidak boleh sampai
			// ke library sebagai "tanpa batas".
			return 0, nil
		}
		return gb << 30, nil
	}
}
