// Package modules memasang modul standar GONSU dari library
// `gonsu-appkit-go`: profil bisnis, website, media, dan wilayah.
//
// Kode modulnya ada di library dan SAMA di setiap produk; ia di-upgrade
// dengan `go get`, tidak disunting di sini. Yang milik produk ini hanya
// perekatnya:
//
//   - organization datang dari `tenant.OrganizationID`, seperti modul lain;
//   - izin library dipetakan ke izin produk (permissions) — siapa yang
//     memegangnya tetap diputuskan matriks `authz`;
//   - galat library ditulis dengan envelope yang sama dengan galat modul lain.
//
// Tabel library berawalan `appkit_` dan migrasinya dijalankan
// `appkit.Migrate` saat start, sebelum migrasi produk (cmd/api/main.go).
package modules

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	appkit "github.com/gonsutrijayautama/gonsu-appkit-go"
	"github.com/gonsutrijayautama/gonsu-appkit-go/businessprofile"
	"github.com/gonsutrijayautama/gonsu-appkit-go/media"
	"github.com/gonsutrijayautama/gonsu-appkit-go/regions"
	"github.com/gonsutrijayautama/gonsu-appkit-go/website"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authn"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authz"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/httpx"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/tenant"
)

// permissions memetakan izin yang diminta library ke izin produk ini. Izin
// library yang tidak ada di sini DITOLAK: modul baru tidak terbuka hanya
// karena library-nya di-upgrade.
var permissions = map[appkit.Permission]authz.Permission{
	businessprofile.Manage: authz.SettingsBusinessManage,
	website.Manage:         authz.SettingsWebsiteManage,
}

// Standard adalah modul standar yang terpasang di produk ini.
type Standard struct {
	// Profiles dipakai modul lain yang butuh identitas bisnis, mis. kepala
	// dokumen yang dicetak: `Profiles.Lookup(ctx, org)`.
	Profiles *businessprofile.Service
	// Sites mengatur halaman depan publik dan menyisipkan datanya ke "/".
	Sites *website.Service
	// Media menyimpan berkas PUBLIK (logo, gambar halaman depan). Lihat
	// dokumentasi package media sebelum menyimpan berkas lain di sana.
	Media *media.Service

	regions []appkit.Route
}

// Options mengatur modul standar. Nilai kosong memakai bawaan.
type Options struct {
	// MediaStore adalah penyimpanan ISI berkas media. Kosong: database.
	// Berkas yang isinya sudah di database tetap terbaca setelah penyimpanan
	// lain dipasang.
	MediaStore media.Store
}

// New menyiapkan modul standar. Dipanggil sekali saat start. installation
// adalah organization pemasangan ini: satu pemasangan melayani satu
// organization, dan dialah pemilik halaman depan yang dibuka tanpa sesi.
func New(pool *pgxpool.Pool, installation uuid.UUID, logger *slog.Logger, opts Options) (*Standard, error) {
	hooks := appkit.Hooks{
		Organization: tenant.OrganizationID,
		Authorize:    authorize,
		WriteError: func(w http.ResponseWriter, r *http.Request, err error) {
			httpx.WriteError(w, r, logger, translate(err))
		},
	}
	files, err := media.New(pool, hooks, media.Options{Store: opts.MediaStore})
	if err != nil {
		return nil, err
	}
	profiles, err := businessprofile.New(pool, files, hooks)
	if err != nil {
		return nil, err
	}
	sites, err := website.New(pool, profiles, files, hooks, website.Options{
		PublicOrganization: func(*http.Request) (uuid.UUID, error) { return installation, nil },
		Logger:             logger,
	})
	if err != nil {
		return nil, err
	}
	regionRoutes, err := regions.Routes(hooks)
	if err != nil {
		return nil, err
	}
	return &Standard{Profiles: profiles, Sites: sites, Media: files, regions: regionRoutes}, nil
}

// Routes memasang endpoint modul standar di bawah /v1, di balik sesi:
//
//	GET    /business-profile
//	PUT    /business-profile          izin settings.business.manage
//	PUT    /business-profile/logo     izin settings.business.manage
//	DELETE /business-profile/logo     izin settings.business.manage
//	GET    /website
//	PUT    /website                   izin settings.website.manage
//	PUT    /website/images/{slot}     izin settings.website.manage
//	DELETE /website/images/{slot}     izin settings.website.manage
//	GET    /regions                   ?parent=
//	GET    /regions/search            ?q=&limit=
func (s *Standard) Routes(r chi.Router) {
	mount(r, s.Profiles.Routes())
	mount(r, s.Sites.Routes())
	mount(r, s.regions)
}

// PublicRoutes memasang endpoint TANPA SESI di akar situs:
//
//	GET /media/{id}    berkas publik
//	GET /site.json     tampilan publik halaman depan
//
// Logo dan halaman depan tampil sebelum ada yang login.
func (s *Standard) PublicRoutes(r chi.Router) {
	mount(r, s.Media.PublicRoutes())
	mount(r, s.Sites.PublicRoutes())
}

// RenderHome menyisipkan identitas bisnis ke halaman depan sebelum disajikan
// (`httpx.Options.Home`). Tidak pernah gagal: tanpa data, halaman
// dikembalikan apa adanya.
func (s *Standard) RenderHome(r *http.Request, page []byte) []byte {
	return s.Sites.RenderHome(r, page)
}

func mount(r chi.Router, routes []appkit.Route) {
	for _, rt := range routes {
		r.Method(rt.Method, rt.Path, rt.Handler)
	}
}

func authorize(ctx context.Context, perm appkit.Permission) error {
	p, known := permissions[perm]
	if !known {
		return apperr.PermissionDenied("Anda tidak memiliki izin untuk tindakan ini.")
	}
	_, err := authn.Check(ctx, p)
	return err
}

// translate mengubah galat library menjadi galat produk. Galat lain —
// termasuk yang dikembalikan authorize — diteruskan apa adanya.
func translate(err error) error {
	e, ok := errors.AsType[*appkit.Error](err)
	if !ok {
		return err
	}
	switch e.Kind {
	case appkit.KindValidation:
		details := make([]apperr.FieldError, 0, len(e.Fields))
		for _, f := range e.Fields {
			details = append(details, apperr.FieldError{Field: f.Field, Message: f.Message})
		}
		return apperr.Validation(e.Message, details...)
	case appkit.KindNotFound:
		return apperr.NotFound(e.Message)
	case appkit.KindConflict:
		return apperr.ConcurrentModification(e.Message)
	}
	// Jenis galat yang belum dikenal produk ini: perlakukan sebagai galat tak
	// terduga, jangan menebak status HTTP-nya.
	return err
}
