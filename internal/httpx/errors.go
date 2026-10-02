package httpx

import (
	"encoding/json"
	"errors"
	"log/slog"
	"math"
	"net/http"
	"strconv"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
)

type errorEnvelope struct {
	Error errorBody `json:"error"`
}

type errorBody struct {
	Code                string              `json:"code"`
	Message             string              `json:"message"`
	RequestID           string              `json:"request_id"`
	Details             []apperr.FieldError `json:"details,omitempty"`
	RequiredEntitlement string              `json:"required_entitlement,omitempty"`
}

// WriteError menulis envelope galat untuk err.
//
// *apperr.Error ditampilkan apa adanya dengan status dari katalognya. Galat
// lain dianggap tak terduga: rinciannya hanya masuk log, pengguna mendapat
// INTERNAL_ERROR beserta request_id untuk menemukannya.
func WriteError(w http.ResponseWriter, r *http.Request, logger *slog.Logger, err error) {
	var appErr *apperr.Error
	if !errors.As(err, &appErr) {
		if logger != nil {
			logger.ErrorContext(r.Context(), "galat tak terduga",
				slog.String("error", err.Error()),
				slog.String("request_id", RequestID(r.Context())))
		}
		appErr = &apperr.Error{
			Code:    apperr.CodeInternalError,
			Message: "Terjadi kesalahan di server. Sebutkan kode permintaan ini saat melapor.",
		}
	}
	// `Retry-After` wajib menyertai 429. Ia dipasang di sini,
	// bukan di middleware pembatasnya, supaya setiap jalur yang mengembalikan
	// RATE_LIMITED membawanya — termasuk 429 yang diteruskan dari GONSU.
	if appErr.RetryAfter > 0 {
		w.Header().Set("Retry-After",
			strconv.Itoa(int(math.Ceil(appErr.RetryAfter.Seconds()))))
	}
	WriteJSON(w, appErr.Status(), errorEnvelope{Error: errorBody{
		Code:                appErr.Code,
		Message:             appErr.Message,
		RequestID:           RequestID(r.Context()),
		Details:             appErr.Details,
		RequiredEntitlement: appErr.RequiredEntitlement,
	}})
}

// WriteJSON menulis v sebagai JSON dengan status yang diberikan.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// WriteRawJSON menulis body JSON yang sudah jadi — dipakai untuk memutar
// ulang response idempoten byte per byte.
func WriteRawJSON(w http.ResponseWriter, status int, body []byte) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

// APINotFound menjawab path API yang tidak dikenal dengan envelope, bukan
// halaman 404 frontend.
func APINotFound(w http.ResponseWriter, r *http.Request) {
	WriteError(w, r, nil, apperr.NotFound("Endpoint tidak ditemukan."))
}
