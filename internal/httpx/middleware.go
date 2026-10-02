package httpx

import (
	"context"
	"crypto/rand"
	"errors"
	"log/slog"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

type requestIDKey struct{}

// RequestID mengembalikan id permintaan yang dipasang middleware, atau string
// kosong di luar permintaan HTTP.
func RequestID(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey{}).(string)
	return id
}

// withRequestID memberi setiap permintaan id acak yang muncul di log, di
// header X-Request-Id, dan di envelope galat — satu nilai yang dapat disebut
// pengguna saat melapor.
//
// Id dari klien tidak dipakai: nilai yang ditulis orang lain ke log adalah
// jalan pintas memalsukan jejak.
func withRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := "req_" + strings.ToLower(rand.Text())
		w.Header().Set("X-Request-Id", id)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), requestIDKey{}, id)))
	})
}

// withAccessLog mencatat setiap permintaan sebagai satu baris log terstruktur.
//
// Probe kubelet dicatat pada level debug: chart GONSU memeriksa GET / untuk
// readiness dan liveness setiap 5 detik, dan tanpa ini keduanya menenggelamkan
// log yang sebenarnya.
func withAccessLog(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			next.ServeHTTP(ww, r)

			level := slog.LevelInfo
			if strings.HasPrefix(r.UserAgent(), "kube-probe/") {
				level = slog.LevelDebug
			}
			logger.LogAttrs(r.Context(), level, "http",
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", ww.Status()),
				slog.Int("bytes", ww.BytesWritten()),
				slog.Float64("duration_ms", float64(time.Since(start).Microseconds())/1000),
				slog.String("request_id", RequestID(r.Context())))
		})
	}
}

var errPanic = errors.New("panic saat melayani permintaan")

// withRecover mengubah panic menjadi 500 ber-envelope. Rinciannya hanya masuk
// log; pengguna mendapat request_id untuk menemukannya.
func withRecover(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				v := recover()
				if v == nil {
					return
				}
				if v == http.ErrAbortHandler {
					panic(v)
				}
				logger.ErrorContext(r.Context(), "panic saat melayani permintaan",
					slog.Any("panic", v),
					slog.String("stack", string(debug.Stack())),
					slog.String("request_id", RequestID(r.Context())))
				// Tanpa logger: rincian panic sudah tercatat di atas beserta stack.
				WriteError(w, r, nil, errPanic)
			}()
			next.ServeHTTP(w, r)
		})
	}
}
