// Package httpx memegang router, middleware, dan envelope galat HTTP.
package httpx

import (
	"io/fs"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// Options adalah dependensi router.
type Options struct {
	// Version ditampilkan di /healthz dan di halaman cadangan "/".
	Version string
	// Frontend adalah hasil static export Next.js; boleh kosong.
	Frontend fs.FS
	Logger   *slog.Logger
	// Routes mendaftarkan route aplikasi (API, login) sebelum frontend
	// menangkap sisanya.
	Routes func(r chi.Router)
}

// NewRouter menyusun seluruh route aplikasi.
func NewRouter(opts Options) http.Handler {
	r := chi.NewRouter()
	r.Use(withRequestID, withAccessLog(opts.Logger), withRecover(opts.Logger))

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		WriteJSON(w, http.StatusOK, map[string]string{"status": "ok", "version": opts.Version})
	})

	if opts.Routes != nil {
		opts.Routes(r)
	}

	// Frontend menangkap semua path lain, termasuk "/".
	//
	// "/" WAJIB menjawab 200 tanpa autentikasi: chart GONSU memakainya sebagai
	// readiness dan liveness probe, dan redirect di sini membuat pod tidak
	// pernah ready tanpa pesan yang menyebut sebabnya.
	// Yang mengarahkan ke GONSU adalah /auth/login, bukan "/".
	frontend := frontendHandler(opts.Frontend, opts.Version, opts.Logger)
	r.Get("/*", frontend.ServeHTTP)
	r.Head("/*", frontend.ServeHTTP)

	return r
}
