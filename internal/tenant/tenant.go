// Package tenant adalah SATU-SATUNYA sumber organization_id. Tidak ada modul
// lain yang boleh membaca organization_id dari environment, body request,
// atau tempat lain.
//
// Organization pemasangan dibuat sekali saat start (EnsureInstallation); per
// request, nilainya dipasang middleware autentikasi dari sesi.
// Bila kelak GONSU menyerahkan ID kanonik, yang berubah hanya package
// ini.
package tenant

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

type ctxKey struct{}

// ErrMissing berarti request tidak membawa konteks organization — selalu
// kesalahan pemrograman (route domain tanpa middleware autentikasi), bukan
// kesalahan pengguna.
var ErrMissing = errors.New("tenant: organization_id tidak ada di context")

// WithOrganizationID memasang organization untuk sisa request.
func WithOrganizationID(ctx context.Context, id uuid.UUID) context.Context {
	return context.WithValue(ctx, ctxKey{}, id)
}

// OrganizationID mengembalikan organization request ini.
func OrganizationID(ctx context.Context) (uuid.UUID, error) {
	id, ok := ctx.Value(ctxKey{}).(uuid.UUID)
	if !ok || id == uuid.Nil {
		return uuid.Nil, ErrMissing
	}
	return id, nil
}
