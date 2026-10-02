package httpx

import (
	"html/template"
	"io/fs"
	"log/slog"
	"net/http"
	"path"
	"strings"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
)

// fallbackPage disajikan di "/" bila binary tidak membawa hasil build frontend
// — biasanya `go run` sebelum `make web`.
//
// Halaman ini ada supaya kontrak probe tidak pernah bergantung pada langkah
// build frontend: tanpanya "/" menjawab 404 dan pod tidak pernah ready. Image
// rilis tidak sampai ke sini, karena Dockerfile menolak build tanpa index.html.
var fallbackPage = template.Must(template.New("fallback").Parse(`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Aplikasi</title>
</head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;font:15px/1.6 system-ui,sans-serif">
<main style="text-align:center;padding:2rem">
<h1 style="margin:0">Aplikasi</h1>
<p style="margin:.25rem 0 1.5rem;opacity:.7">Versi {{.Version}}</p>
<p><a href="/auth/login">Masuk</a></p>
<p style="opacity:.6"><small>Frontend belum di-build; ini halaman cadangan dari server. Jalankan <code>make web</code>.</small></p>
</main>
</body>
</html>
`))

// frontendHandler menyajikan hasil static export Next.js.
func frontendHandler(frontend fs.FS, version string, logger *slog.Logger) http.Handler {
	hasIndex := exists(frontend, "index.html")
	if !hasIndex {
		logger.Warn("frontend belum di-build: \"/\" menyajikan halaman cadangan (jalankan `make web`)")
	}
	notFoundPage, _ := fs.ReadFile(frontend, "404.html")
	files := http.FileServerFS(frontend)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" && !hasIndex {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_ = fallbackPage.Execute(w, struct{ Version string }{version})
			return
		}
		if !servable(frontend, r.URL.Path) {
			if notFoundPage != nil {
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				w.WriteHeader(http.StatusNotFound)
				_, _ = w.Write(notFoundPage)
				return
			}
			WriteError(w, r, nil, apperr.NotFound("Halaman tidak ditemukan."))
			return
		}
		if strings.HasPrefix(r.URL.Path, "/_next/static/") {
			// Nama berkas di bawah _next/static memuat hash isinya, jadi aman
			// disimpan browser selamanya.
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		files.ServeHTTP(w, r)
	})
}

// servable melaporkan apakah urlPath menunjuk sebuah berkas, atau direktori
// yang punya index.html. Direktori tanpa index.html dianggap tidak ada —
// kalau tidak, FileServer menampilkan daftar isinya.
func servable(fsys fs.FS, urlPath string) bool {
	name := strings.TrimPrefix(path.Clean(urlPath), "/")
	if name == "" {
		name = "."
	}
	info, err := fs.Stat(fsys, name)
	if err != nil {
		return false
	}
	if info.IsDir() {
		return exists(fsys, path.Join(name, "index.html"))
	}
	return true
}

func exists(fsys fs.FS, name string) bool {
	_, err := fs.Stat(fsys, name)
	return err == nil
}
