//go:build !dev

package authn

import (
	"github.com/go-chi/chi/v5"
)

const devLoginEnabled = false

// MountLogin pada binary rilis: /auth/login selalu ke GONSU. Tanpa
// konfigurasi login, kit mengarahkan pengunjung ke halaman yang menyebut
// sebabnya — tidak ada jalan masuk lain.
func MountLogin(r chi.Router, d LoginDeps) {
	r.Get("/auth/login", startGonsu)
	d.mountCommon(r)
}
