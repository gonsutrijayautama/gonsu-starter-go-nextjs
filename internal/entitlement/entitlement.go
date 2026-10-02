// Package entitlement adalah seam hak komersial.
// Key entitlement HANYA dikenal di package ini, sebagai konstanta: satu
// karakter salah pada string literal di modul lain berarti capability mati
// diam-diam.
//
// Jawabannya datang dari kit web SDK GONSU, untuk
// kedua mode:
//
//	cloud      nilai paket dari lease yang ditandatangani GONSU; Allowed selalu
//	           true — langganan yang berhenti ditegakkan GONSU dengan
//	           menangguhkan aplikasinya
//	self-host  kesimpulan agent GONSU di GONSU_AGENT_URL
//
// Package ini tidak memverifikasi apa pun sendiri; ia memasang jawaban kit di
// route (Guard) dan menyajikannya ke UI (StatusHandler).
package entitlement

import (
	"context"
	"net/http"

	"github.com/gonsutrijayautama/gonsu-one-sdk-go/web"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/httpx"
)

// ProductCode adalah kode produk di katalog GONSU — harus sama persis dengan
// kode di Console. Lease yang menyebut produk
// lain ditolak kit.
const ProductCode = "produk-contoh"

// Key entitlement produk. Tambahkan key baru di sini, bukan
// sebagai string di modul pemakainya.
const (
	// Core menjaga seluruh service layer domain produk.
	Core = "produk-contoh.core"
	// UsersMax membatasi jumlah pengguna aktif pemasangan.
	UsersMax = "users.max"
)

// Resolver menjawab hak komersial pemasangan ini.
type Resolver interface {
	Allowed(ctx context.Context) bool
	Feature(ctx context.Context, key string) bool
	// Limit mengembalikan nilai batas dan apakah batasnya tak terbatas.
	Limit(ctx context.Context, key string) (value int64, unlimited bool)
}

// Source adalah Resolver yang juga dapat menjelaskan keadaannya, untuk banner
// di UI. Frontend tidak pernah bertanya ke agent sendiri.
// *web.License memenuhinya.
type Source interface {
	Resolver
	Status(ctx context.Context) Status
}

// Status dan Phase milik kit: bentuk JSON-nya adalah jawaban GET /v1/license
// yang dibaca banner UI.
type (
	Status = web.Status
	Phase  = web.Phase
)

// Fase lisensi yang dilihat pengguna.
const (
	PhaseNormal = web.PhaseNormal
	// PhaseGrace: lease kedaluwarsa tetapi masih dalam masa tenggang —
	// operasi normal, peringatan menonjol.
	PhaseGrace = web.PhaseGrace
	// PhaseRestricted: transaksi baru ditolak; membaca dan ekspor tetap jalan.
	PhaseRestricted = web.PhaseRestricted
	// PhaseNotActivated: agent belum pernah diaktivasi, atau kehilangan
	// state-nya.
	PhaseNotActivated = web.PhaseNotActivated
	// PhaseUnreachable: agent belum pernah terjawab sejak produk start.
	// Gagal-terbuka: kantor tidak berhenti karena satu request gagal.
	PhaseUnreachable = web.PhaseUnreachable
	// PhaseUnlicensed: cloud tanpa nilai lease — GONSU belum menyerahkan
	// kunci atau lease-nya. Semua fitur menyala dan tanpa batas.
	PhaseUnlicensed = web.PhaseUnlicensed
)

// Noop mengizinkan semuanya tanpa batas. Pemasangan sungguhan memakai
// *web.License; Noop untuk test yang tidak sedang menguji hak pakai.
type Noop struct{}

func (Noop) Allowed(context.Context) bool                { return true }
func (Noop) Feature(context.Context, string) bool        { return true }
func (Noop) Limit(context.Context, string) (int64, bool) { return 0, true }
func (Noop) Status(context.Context) Status {
	return Status{Mode: web.ModeCloud, Phase: PhaseUnlicensed, Allowed: true}
}

// Guard adalah boundary capability untuk key, dipasang pada
// route — bukan disembunyikan di UI.
//
//   - Lisensi tidak aktif: mutasi ditolak LICENSE_INACTIVE; GET dan HEAD
//     tetap lolos, karena data pelanggan tidak disandera.
//   - Lisensi aktif tanpa fitur key: ditolak ENTITLEMENT_REQUIRED.
func Guard(s Source, key string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			safe := r.Method == http.MethodGet || r.Method == http.MethodHead
			if !s.Allowed(ctx) {
				if !safe {
					httpx.WriteError(w, r, nil, apperr.LicenseInactive(inactiveMessage(s.Status(ctx).Phase)))
					return
				}
			} else if !s.Feature(ctx, key) {
				httpx.WriteError(w, r, nil, apperr.EntitlementRequired(key))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func inactiveMessage(p Phase) string {
	if p == PhaseNotActivated {
		return "Pemasangan ini belum diaktivasi, jadi transaksi baru belum dapat disimpan. " +
			"Data tetap dapat dibaca. Aktivasi dilakukan di server lewat `gonsu-agent install`."
	}
	return "Lisensi pemasangan ini sedang tidak aktif, jadi transaksi baru ditolak. " +
		"Data tetap dapat dibaca dan diekspor."
}

// StatusHandler: GET /v1/license, keadaan lisensi untuk banner UI.
func StatusHandler(s Source) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteJSON(w, http.StatusOK, s.Status(r.Context()))
	}
}
