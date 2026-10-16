package stockmedia

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
)

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

// newTestService: layanan yang bertanya ke upstream, dengan jam yang bisa dimajukan.
func newTestService(t *testing.T, upstream http.Handler) (*Service, *atomic.Int64) {
	t.Helper()
	server := httptest.NewServer(upstream)
	t.Cleanup(server.Close)
	clock := &atomic.Int64{}
	clock.Store(time.Date(2026, 10, 4, 8, 0, 0, 0, time.UTC).Unix())
	s, err := NewService(Options{APIKey: "kunci", BaseURL: server.URL, Logger: quiet, Now: func() time.Time { return time.Unix(clock.Load(), 0) }})
	if err != nil {
		t.Fatal(err)
	}
	return s, clock
}

// Batas Pixabay 100 permintaan per menit. Yang dikirim dari sini berhenti di
// bawah itu, dan yang berlebih ditolak tanpa menghubungi Pixabay.
func TestUpstreamRequestsStayUnderPixabayLimit(t *testing.T) {
	var hits atomic.Int64
	s, clock := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		_, _ = io.WriteString(w, `{"hits":[]}`)
	}))
	ask := func(i int) error {
		var page struct{}
		_, err := s.get(context.Background(), "/api/", url.Values{"id": {strconv.Itoa(i)}}, &page)
		return err
	}

	for i := 0; i < maxUpstreamPerMinute; i++ {
		if err := ask(i); err != nil {
			t.Fatalf("permintaan ke-%d ditolak: %v", i+1, err)
		}
	}
	var limited *apperr.Error
	if err := ask(maxUpstreamPerMinute); !errors.As(err, &limited) || limited.Code != apperr.CodeRateLimited || limited.RetryAfter <= 0 {
		t.Fatalf("permintaan sesudah batas = %v, want RATE_LIMITED dengan Retry-After", err)
	}
	if got := hits.Load(); got != maxUpstreamPerMinute {
		t.Errorf("Pixabay menerima %d permintaan, want %d", got, maxUpstreamPerMinute)
	}
	if maxUpstreamPerMinute >= 100 {
		t.Errorf("batas keluar %d harus di bawah batas Pixabay (100 per menit)", maxUpstreamPerMinute)
	}

	// Yang sudah di-cache tetap dijawab selama batas tercapai.
	if err := ask(0); err != nil {
		t.Errorf("jawaban dari cache ikut ditolak: %v", err)
	}
	// Semenit kemudian jatahnya kembali.
	clock.Add(61)
	if err := ask(maxUpstreamPerMinute); err != nil {
		t.Errorf("sesudah semenit masih ditolak: %v", err)
	}
}

// Permintaan yang sama yang datang bersamaan (kisi pustaka media dibuka dua
// orang sekaligus) dikirim ke Pixabay satu kali.
func TestConcurrentIdenticalRequestsShareOneUpstreamCall(t *testing.T) {
	var hits atomic.Int64
	release := make(chan struct{})
	s, _ := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		<-release
		_, _ = io.WriteString(w, `{"hits":[]}`)
	}))

	var wg sync.WaitGroup
	errs := make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			var page struct{}
			_, err := s.get(context.Background(), "/api/", url.Values{"q": {"sama"}}, &page)
			errs <- err
		}()
	}
	// Tunggu sampai satu permintaan sampai ke upstream, lalu beri waktu yang lain menumpuk di belakangnya.
	for hits.Load() == 0 {
		time.Sleep(time.Millisecond)
	}
	time.Sleep(20 * time.Millisecond)
	close(release)
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Errorf("salah satu permintaan gagal: %v", err)
		}
	}
	if got := hits.Load(); got != 1 {
		t.Errorf("Pixabay menerima %d permintaan untuk hal yang sama, want 1", got)
	}
}
