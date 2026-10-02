// Package idempotency membuat mutasi yang diulang client — karena timeout,
// koneksi putus, atau tombol ditekan dua kali — tidak menghasilkan dokumen
// ganda. Bentuknya sama dengan GONSU One.
//
// Alurnya bersama transaksi dokumen:
//
//	Replay (di luar transaksi) → sudah ada? putar ulang response-nya
//	Claim  (di dalam transaksi) → key dikunci bersama dokumen yang dibuat
//	Complete (transaksi yang sama) → response disimpan, lalu commit
//
// Karena klaim dan dokumen di-commit bersama, tidak ada keadaan "dokumen
// sudah ada tetapi key belum tercatat" yang membuat retry menggandakannya.
package idempotency

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"regexp"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/idempotency/store"
)

// Header adalah nama header idempotency.
const Header = "Idempotency-Key"

// ttl: selama ini retry dengan key yang sama diputar ulang.
const ttl = 24 * time.Hour

var keyPattern = regexp.MustCompile(`^[A-Za-z0-9._:-]{8,200}$`)

// Key membaca Idempotency-Key. Wajib pada endpoint yang memakainya.
func Key(r *http.Request) (string, error) {
	k := r.Header.Get(Header)
	if k == "" {
		return "", apperr.Validation("Header Idempotency-Key wajib diisi.")
	}
	if !keyPattern.MatchString(k) {
		return "", apperr.Validation("Header Idempotency-Key tidak valid: 8–200 karakter huruf, angka, atau . _ : -.")
	}
	return k, nil
}

// Fingerprint adalah sidik jari body request. Key sama dengan body berbeda
// adalah kesalahan client, bukan pengulangan.
func Fingerprint(body []byte) string {
	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:])
}

// Scope mengidentifikasi satu key: per organization dan endpoint.
type Scope struct {
	OrganizationID uuid.UUID
	Endpoint       string
	Key            string
	Fingerprint    string
}

// Response adalah response yang disimpan dan diputar ulang byte per byte.
type Response struct {
	Status   int
	Body     []byte
	Replayed bool
}

// Replay mengembalikan response tersimpan untuk key ini, atau nil bila key
// belum pernah dipakai.
func Replay(ctx context.Context, db store.DBTX, s Scope) (*Response, error) {
	row, err := store.New(db).GetKey(ctx, store.GetKeyParams{
		OrganizationID: s.OrganizationID, Endpoint: s.Endpoint, IdempotencyKey: s.Key,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if row.RequestFingerprint != s.Fingerprint {
		return nil, apperr.IdempotencyKeyConflict("Idempotency-Key ini sudah dipakai untuk permintaan dengan isi berbeda.")
	}
	if row.ResponseStatus == nil {
		return nil, apperr.IdempotencyKeyConflict("Permintaan dengan Idempotency-Key ini masih diproses.")
	}
	return &Response{Status: int(*row.ResponseStatus), Body: row.ResponseBody, Replayed: true}, nil
}

// Claim mengunci key di dalam transaksi dokumen. false berarti request lain
// sudah meng-commit key yang sama lebih dulu — panggil Replay.
func Claim(ctx context.Context, tx store.DBTX, s Scope) (bool, error) {
	_, err := store.New(tx).ClaimKey(ctx, store.ClaimKeyParams{
		OrganizationID:     s.OrganizationID,
		Endpoint:           s.Endpoint,
		IdempotencyKey:     s.Key,
		RequestFingerprint: s.Fingerprint,
		ExpiresAt:          time.Now().Add(ttl),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

// Complete menyimpan response di transaksi yang sama dengan dokumennya.
func Complete(ctx context.Context, tx store.DBTX, s Scope, resp Response) error {
	status := int32(resp.Status)
	return store.New(tx).CompleteKey(ctx, store.CompleteKeyParams{
		ResponseStatus: &status,
		ResponseBody:   resp.Body,
		OrganizationID: s.OrganizationID,
		Endpoint:       s.Endpoint,
		IdempotencyKey: s.Key,
	})
}
