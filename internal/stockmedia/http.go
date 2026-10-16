package stockmedia

import (
	"io"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/httpx"
)

// Routes:
//
//	GET /stock-media                    ?category=<kategori>&page=<1..3>
//	GET /stock-media/photos/{id}/file   isi satu foto
//	GET /stock-media/videos/{id}        satu video
func Routes(r chi.Router, s *Service, logger *slog.Logger) {
	h := handler{s: s, logger: logger}
	r.Get("/stock-media", h.search)
	r.Get("/stock-media/photos/{id}/file", h.photoFile)
	r.Get("/stock-media/videos/{id}", h.video)
}

type handler struct {
	s      *Service
	logger *slog.Logger
}

func (h handler) fail(w http.ResponseWriter, r *http.Request, err error) {
	httpx.WriteError(w, r, h.logger, err)
}

// pathID: id yang bukan angka positif dijawab sama dengan media yang tidak ada.
func pathID(r *http.Request) (int64, error) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		return 0, errNotFound
	}
	return id, nil
}

func (h handler) search(w http.ResponseWriter, r *http.Request) {
	// page yang bukan angka dianggap halaman pertama, seperti page di luar rentangnya.
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	out, err := h.s.Search(r.Context(), r.URL.Query().Get("category"), page)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"data": out, "configured": h.s.Configured(), "source": Source})
}

func (h handler) video(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	out, err := h.s.Video(r.Context(), id)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"data": out})
}

func (h handler) photoFile(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	file, err := h.s.PhotoFile(r.Context(), id)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	defer file.Body.Close()
	w.Header().Set("Content-Type", file.ContentType)
	// Isinya gambar dari luar: peramban tidak boleh menebak jenisnya sendiri.
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "private, max-age=86400")
	w.WriteHeader(http.StatusOK)
	if _, err := io.Copy(w, file.Body); err != nil {
		h.logger.WarnContext(r.Context(), "kirim foto Pixabay terputus", "id", id, "error", err)
	}
}
