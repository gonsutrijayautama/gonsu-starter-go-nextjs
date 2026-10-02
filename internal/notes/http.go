package notes

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/httpx"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/idempotency"
)

// Routes:
//
//	GET    /notes          ?limit=
//	POST   /notes          wajib Idempotency-Key
//	GET    /notes/{id}
//	PUT    /notes/{id}
//	DELETE /notes/{id}
func Routes(r chi.Router, s *Service, logger *slog.Logger) {
	h := handler{s: s, logger: logger}
	r.Get("/notes", h.list)
	r.Post("/notes", h.create)
	r.Get("/notes/{id}", h.get)
	r.Put("/notes/{id}", h.update)
	r.Delete("/notes/{id}", h.delete)
}

type handler struct {
	s      *Service
	logger *slog.Logger
}

func (h handler) fail(w http.ResponseWriter, r *http.Request, err error) {
	httpx.WriteError(w, r, h.logger, err)
}

// pathID: id yang bukan UUID dijawab sama dengan catatan yang tidak ada.
func pathID(r *http.Request) (uuid.UUID, error) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		return uuid.Nil, errNotFound
	}
	return id, nil
}

func (h handler) list(w http.ResponseWriter, r *http.Request) {
	out, err := h.s.List(r.Context(), httpx.QueryLimit(r, 50, 200))
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"data": out})
}

func (h handler) create(w http.ResponseWriter, r *http.Request) {
	key, err := idempotency.Key(r)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	body, err := httpx.ReadBody(w, r)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	var req Request
	if err := httpx.DecodeJSON(body, &req); err != nil {
		h.fail(w, r, err)
		return
	}
	resp, err := h.s.Create(r.Context(), req, key, idempotency.Fingerprint(body))
	if err != nil {
		h.fail(w, r, err)
		return
	}
	if resp.Replayed {
		w.Header().Set("Idempotent-Replayed", "true")
	}
	// Body sudah JSON jadi, dan diputar ulang byte per byte: WriteJSON akan
	// mengodekannya ulang sebagai string base64.
	httpx.WriteRawJSON(w, resp.Status, resp.Body)
}

func (h handler) get(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	out, err := h.s.Get(r.Context(), id)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (h handler) update(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	body, err := httpx.ReadBody(w, r)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	var req Request
	if err := httpx.DecodeJSON(body, &req); err != nil {
		h.fail(w, r, err)
		return
	}
	out, err := h.s.Update(r.Context(), id, req)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (h handler) delete(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	if err := h.s.Delete(r.Context(), id); err != nil {
		h.fail(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
