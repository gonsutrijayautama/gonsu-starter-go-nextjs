package main

import (
	"context"
	"log/slog"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gonsutrijayautama/gonsu-one-sdk-go/web"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authn"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/config"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/entitlement"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/httpx"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/modules"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/notes"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/tenant"
)

// app adalah yang dibutuhkan route: pemasangan ini, sesinya, dan kit GONSU
// yang menjawab login, hak pakai, dan pemberian akses.
type app struct {
	pool     *pgxpool.Pool
	logger   *slog.Logger
	org      uuid.UUID
	kit      *web.Kit
	sessions *authn.Sessions
	// license adalah kit.License(); dipisah supaya test dapat menggantinya.
	license entitlement.Source
	// modules adalah modul standar GONSU: profil bisnis, media, wilayah.
	modules *modules.Standard
	// gonsuLogin: GONSU memberi pemasangan ini login (config.GonsuLoginConfigured).
	gonsuLogin bool
	// trustedProxies: reverse proxy yang boleh dipercaya menuliskan
	// `X-Forwarded-For`. Kosong berarti header itu diabaikan seluruhnya.
	trustedProxies httpx.TrustedProxies
}

// prepare dijalankan sekali saat start, sesudah migrasi: kit GONSU,
// organization pemasangan, lalu sesi. Tidak menghubungi GONSU; pada self-host
// agent ditanya sekali, untuk organization pemasangan.
func prepare(ctx context.Context, pool *pgxpool.Pool, cfg config.Config, logger *slog.Logger) (app, error) {
	getenv := cfg.Getenv
	if getenv == nil {
		getenv = func(string) string { return "" }
	}
	login := authn.NewGonsuLogin(pool, logger)
	kit, err := web.New(web.Options{
		ProductCode: entitlement.ProductCode,
		Version:     version,
		Hooks:       login.Hooks(),
		Pending:     authn.NewLoginAttempts(pool),
		Logger:      logger,
		Getenv:      getenv,
	})
	if err != nil {
		return app{}, err
	}

	// Cloud: organization dari Secret. Self-host: dari jawaban agent; kosong
	// bila agent belum menjawab, dan dicatat pada start berikutnya.
	gonsuOrg, _ := kit.Installation(ctx)
	inst, err := tenant.EnsureInstallation(ctx, pool, gonsuOrg)
	if err != nil {
		return app{}, err
	}

	sessions := authn.NewSessions(pool, kit, cfg.OIDCRecheck, logger)
	login.Bind(kit, inst.OrganizationID, sessions)

	store, err := mediaStore(ctx, cfg.ObjectStorage, logger)
	if err != nil {
		return app{}, err
	}
	standard, err := modules.New(pool, inst.OrganizationID, logger, modules.Options{MediaStore: store})
	if err != nil {
		return app{}, err
	}

	return app{pool: pool, logger: logger, org: inst.OrganizationID, kit: kit, sessions: sessions,
		license: kit.License(), modules: standard, gonsuLogin: cfg.GonsuLoginConfigured(),
		trustedProxies: httpx.ParseTrustedProxies(cfg.TrustedProxies)}, nil
}

// routes merangkai route aplikasi. Urutan penjagaan /v1:
//
//	CrossOrigin  mutasi lintas origin (CSRF) ditolak
//	Sessions     tanpa sesi yang sah: 401 — tidak ada API bisnis tanpa identitas
//	entitlement  lisensi dan hak pakai utama untuk seluruh API bisnis
//	service      izin per tindakan (authn.Check)
func (a app) routes() (func(chi.Router), error) {
	// Pembatas laju in-process. Dibuat SEKALI di sini: state-nya adalah
	// pembatasnya, dan membuatnya per-request berarti setiap permintaan
	// mendapat bucket yang penuh.
	limits := httpx.NewLimits()

	return func(r chi.Router) {
		authn.MountLogin(r, authn.LoginDeps{
			Pool: a.pool, Sessions: a.sessions, Kit: a.kit, GonsuLogin: a.gonsuLogin, Organization: a.org,
			Logger: a.logger, Limits: limits, TrustedProxies: a.trustedProxies,
		})
		// Tanpa sesi: berkas media publik (logo) dan data halaman depan tampil
		// sebelum ada yang login.
		a.modules.PublicRoutes(r)
		r.Route("/v1", func(api chi.Router) {
			// Urutan: sesi dulu, baru pembatas. Pembatas memakai id pengguna
			// sebagai kunci, dan satu kantor berbagi satu alamat publik —
			// mengunci pada IP di sana berarti satu orang yang sibuk memblokir
			// seluruh kantor.
			api.Use(httpx.CrossOrigin(), a.sessions.Middleware(), limits.ByRoute(authn.ByUser))
			api.NotFound(httpx.APINotFound)
			api.Get("/me", authn.Me(a.kit.PortalConfigured()))
			api.Get("/license", entitlement.StatusHandler(a.license))
			authn.UserRoutes(api, authn.NewUserAdmin(a.pool, a.license, a.kit.Identities(), a.logger), a.logger)
			// Modul standar: profil bisnis, website, dan wilayah. Di luar hak pakai utama,
			// seperti Pengguna & Akses — identitas bisnis tetap tampil dan dapat
			// dibetulkan walau langganan sedang tidak aktif.
			a.modules.Routes(api)

			// API bisnis: seluruhnya di balik hak pakai utama produk. Modul
			// baru dipasang di sini.
			api.Group(func(business chi.Router) {
				business.Use(entitlement.Guard(a.license, entitlement.Core))
				notes.Routes(business, notes.NewService(a.pool), a.logger)
			})
		})
	}, nil
}
