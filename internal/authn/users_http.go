package authn

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/httpx"
)

// UserRoutes: layar Pengguna & Akses.
//
//	GET   /users        daftar, kuota, dan kesiapan pemberian akses
//	POST  /users        beri akses login lewat email (GONSU membuatkan akunnya)
//	PATCH /users/{id}   ubah role atau status
//
// Sengaja di luar Guard lisensi: mencabut akses orang yang keluar tidak boleh
// terhalang lisensi yang sedang tidak aktif.
func UserRoutes(r chi.Router, u *UserAdmin, logger *slog.Logger) {
	h := userHandler{u: u, logger: logger}
	r.Get("/users", h.list)
	r.Post("/users", h.invite)
	r.Patch("/users/{id}", h.update)
}

type userHandler struct {
	u      *UserAdmin
	logger *slog.Logger
}

func (h userHandler) list(w http.ResponseWriter, r *http.Request) {
	res, err := h.u.List(r.Context())
	if err != nil {
		httpx.WriteError(w, r, h.logger, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h userHandler) invite(w http.ResponseWriter, r *http.Request) {
	body, err := httpx.ReadBody(w, r)
	if err != nil {
		httpx.WriteError(w, r, h.logger, err)
		return
	}
	var req InviteRequest
	if err := httpx.DecodeJSON(body, &req); err != nil {
		httpx.WriteError(w, r, h.logger, err)
		return
	}
	res, err := h.u.Invite(r.Context(), req)
	if err != nil {
		httpx.WriteError(w, r, h.logger, err)
		return
	}
	// Jawaban dapat membawa sandi sementara: tidak boleh disimpan cache mana
	// pun di antara server dan browser.
	w.Header().Set("Cache-Control", "no-store")
	httpx.WriteJSON(w, http.StatusCreated, res)
}

func (h userHandler) update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, r, h.logger, apperr.NotFound("Pengguna tidak ditemukan."))
		return
	}
	body, err := httpx.ReadBody(w, r)
	if err != nil {
		httpx.WriteError(w, r, h.logger, err)
		return
	}
	var req UpdateRequest
	if err := httpx.DecodeJSON(body, &req); err != nil {
		httpx.WriteError(w, r, h.logger, err)
		return
	}
	res, err := h.u.Update(r.Context(), id, req)
	if err != nil {
		httpx.WriteError(w, r, h.logger, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}
