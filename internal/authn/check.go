package authn

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authz"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/httpx"
)

// Check memastikan pengguna request ini memegang permission, dan
// mengembalikannya. Dipanggil di service — batas akses ditegakkan server,
// bukan dengan menyembunyikan menu.
func Check(ctx context.Context, perm authz.Permission) (Principal, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return Principal{}, errNoSession
	}
	if !authz.Can(p.Role, perm) {
		return p, apperr.PermissionDenied("Anda tidak memiliki izin untuk tindakan ini.")
	}
	return p, nil
}

// requirePermission menjaga route yang bukan service — jalur kit GONSU —
// dengan izin yang sama seperti Check. Dipasang SESUDAH middleware sesi.
func requirePermission(perm authz.Permission, logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if _, err := Check(r.Context(), perm); err != nil {
				httpx.WriteError(w, r, logger, err)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
