package httpx

import (
	"net/http"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
)

// CrossOrigin menolak request mutasi yang datang dari origin lain (CSRF).
//
// Sesi produk ada di cookie, sehingga browser mengirimnya
// pada request dari situs mana pun. Pemeriksaan standard library Go memakai
// Sec-Fetch-Site/Origin: GET dan HEAD selalu lolos, mutasi lintas origin
// ditolak. Tidak perlu token CSRF di form, dan tidak ada dependency baru.
func CrossOrigin() func(http.Handler) http.Handler {
	p := http.NewCrossOriginProtection()
	p.SetDenyHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		WriteError(w, r, nil, apperr.PermissionDenied("Permintaan lintas origin ditolak."))
	}))
	return p.Handler
}
