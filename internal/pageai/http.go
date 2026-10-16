package pageai

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/httpx"
)

// Routes:
//
//	GET  /page-ai           apakah asisten AI aktif
//	POST /page-ai/replies   satu jawaban, dialirkan per baris (NDJSON)
//
// limit membatasi laju jawaban: setiap jawaban adalah panggilan berbayar.
func Routes(r chi.Router, s *Service, limit func(http.Handler) http.Handler, logger *slog.Logger) {
	h := handler{s: s, logger: logger}
	r.Get("/page-ai", h.status)
	r.With(limit).Post("/page-ai/replies", h.reply)
}

type handler struct {
	s      *Service
	logger *slog.Logger
}

func (h handler) status(w http.ResponseWriter, r *http.Request) {
	out, err := h.s.Status(r.Context())
	if err != nil {
		httpx.WriteError(w, r, h.logger, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"data": out})
}

func (h handler) reply(w http.ResponseWriter, r *http.Request) {
	body, err := httpx.ReadBody(w, r)
	if err != nil {
		httpx.WriteError(w, r, h.logger, err)
		return
	}
	var in Request
	if err := httpx.DecodeJSON(body, &in); err != nil {
		httpx.WriteError(w, r, h.logger, err)
		return
	}
	reply, err := h.s.Design(r.Context(), in)
	if err != nil {
		httpx.WriteError(w, r, h.logger, err)
		return
	}
	defer reply.Close()

	w.Header().Set("Content-Type", "application/x-ndjson")
	w.Header().Set("Cache-Control", "no-store")
	// Proxy di depan aplikasi tidak boleh menahan baris sampai jawabannya selesai.
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher := http.NewResponseController(w)
	enc := json.NewEncoder(w)
	emit := func(event Event) error {
		if err := enc.Encode(event); err != nil {
			return err
		}
		return flusher.Flush()
	}

	err = reply.Stream(r.Context(), emit)
	switch {
	case err == nil:
		_ = emit(Event{Type: "done"})
	case r.Context().Err() != nil:
		// Pengguna menghentikan jawabannya atau menutup editor: tidak ada
		// yang membaca lagi.
	default:
		// Status 200 sudah terkirim, jadi galatnya ikut mengalir sebagai kejadian.
		var known *apperr.Error
		if !errors.As(err, &known) {
			h.logger.ErrorContext(r.Context(), "aliran asisten halaman gagal", "error", err, "request_id", httpx.RequestID(r.Context()))
			known = errUnavailable
		}
		_ = emit(Event{Type: "error", Code: known.Code, Message: known.Message})
	}
}
