package httpx

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
)

var discard = slog.New(slog.NewTextHandler(io.Discard, nil))

// builtFrontend meniru isi web/out setelah `next build` dengan
// output: "export" dan trailingSlash: true.
func builtFrontend() fstest.MapFS {
	return fstest.MapFS{
		"index.html":                      {Data: []byte("<html>landing</html>")},
		"404.html":                        {Data: []byte("<html>tidak ada</html>")},
		"notes/index.html":                {Data: []byte("<html>notes</html>")},
		"_next/static/chunks/app-1a2b.js": {Data: []byte("console.log(1)")},
	}
}

func serve(t *testing.T, frontend fstest.MapFS, method, target string, header map[string]string) *http.Response {
	t.Helper()
	h := NewRouter(Options{Version: "1.2.3", Frontend: frontend, Logger: discard})
	req := httptest.NewRequest(method, target, nil)
	for k, v := range header {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec.Result()
}

func body(t *testing.T, resp *http.Response) string {
	t.Helper()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

// Kontrak chart GONSU: GET / menjawab 200 tanpa autentikasi, bukan redirect —
// dengan maupun tanpa hasil build frontend di dalam binary.
func TestRootAnswers200WithoutAuth(t *testing.T) {
	tests := []struct {
		name     string
		frontend fstest.MapFS
		contains []string
	}{
		{"frontend ter-build", builtFrontend(), []string{"landing"}},
		{"frontend belum di-build", fstest.MapFS{".gitkeep": {}}, []string{"Aplikasi", "1.2.3", `href="/auth/login"`}},
	}
	for _, tt := range tests {
		for _, ua := range []string{"", "kube-probe/1.33"} {
			t.Run(tt.name+"/"+ua, func(t *testing.T) {
				resp := serve(t, tt.frontend, http.MethodGet, "/", map[string]string{"User-Agent": ua})
				if resp.StatusCode != http.StatusOK {
					t.Fatalf("GET / = %d (Location %q), want 200", resp.StatusCode, resp.Header.Get("Location"))
				}
				got := body(t, resp)
				for _, s := range tt.contains {
					if !strings.Contains(got, s) {
						t.Errorf("body tidak memuat %q:\n%s", s, got)
					}
				}
			})
		}
	}
}

func TestHeadRootAnswers200(t *testing.T) {
	resp := serve(t, builtFrontend(), http.MethodHead, "/", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("HEAD / = %d, want 200", resp.StatusCode)
	}
}

func TestHealthzReportsVersion(t *testing.T) {
	resp := serve(t, builtFrontend(), http.MethodGet, "/healthz", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET /healthz = %d", resp.StatusCode)
	}
	var got map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if got["status"] != "ok" || got["version"] != "1.2.3" {
		t.Errorf("healthz = %v", got)
	}
}

func TestNestedRouteServesItsIndex(t *testing.T) {
	resp := serve(t, builtFrontend(), http.MethodGet, "/notes/", nil)
	if resp.StatusCode != http.StatusOK || body(t, resp) != "<html>notes</html>" {
		t.Fatalf("GET /notes/ = %d", resp.StatusCode)
	}
}

func TestHashedAssetsAreCachedForever(t *testing.T) {
	resp := serve(t, builtFrontend(), http.MethodGet, "/_next/static/chunks/app-1a2b.js", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	if cc := resp.Header.Get("Cache-Control"); !strings.Contains(cc, "immutable") {
		t.Errorf("Cache-Control = %q, want immutable", cc)
	}
}

func TestNotFound(t *testing.T) {
	t.Run("halaman 404 frontend dipakai bila ada", func(t *testing.T) {
		resp := serve(t, builtFrontend(), http.MethodGet, "/missing/", nil)
		if resp.StatusCode != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", resp.StatusCode)
		}
		if got := body(t, resp); got != "<html>tidak ada</html>" {
			t.Errorf("body = %q", got)
		}
	})

	t.Run("direktori tanpa index.html tidak ditampilkan isinya", func(t *testing.T) {
		resp := serve(t, builtFrontend(), http.MethodGet, "/_next/static/chunks/", nil)
		if resp.StatusCode != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", resp.StatusCode)
		}
	})

	t.Run("tanpa halaman 404 jatuh ke envelope galat", func(t *testing.T) {
		resp := serve(t, fstest.MapFS{}, http.MethodGet, "/missing", nil)
		if resp.StatusCode != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", resp.StatusCode)
		}
		env := decodeEnvelope(t, resp)
		if env.Error.Code != apperr.CodeResourceNotFound {
			t.Errorf("code = %q", env.Error.Code)
		}
		if env.Error.RequestID == "" || env.Error.RequestID != resp.Header.Get("X-Request-Id") {
			t.Errorf("request_id %q tidak sama dengan header %q", env.Error.RequestID, resp.Header.Get("X-Request-Id"))
		}
	})
}

// Home mengolah halaman depan sebelum disajikan — dan hanya halaman depan.
func TestHomeHookRendersIndex(t *testing.T) {
	h := NewRouter(Options{
		Version: "1.2.3", Frontend: builtFrontend(), Logger: discard,
		Home: func(_ *http.Request, page []byte) []byte {
			return append([]byte("<!-- bisnis -->"), page...)
		},
	})
	get := func(method, path string) *http.Response {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(method, path, nil))
		return rec.Result()
	}

	resp := get(http.MethodGet, "/")
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK || !strings.HasPrefix(string(body), "<!-- bisnis -->") || !strings.Contains(string(body), "landing") {
		t.Errorf("GET / = %d %q", resp.StatusCode, body)
	}
	// Isinya dapat berubah kapan saja, jadi tidak disimpan peramban.
	if got := resp.Header.Get("Cache-Control"); got != "no-cache" {
		t.Errorf("Cache-Control halaman depan = %q", got)
	}

	// HEAD: status dan panjang yang sama, tanpa isi — probe boleh memakainya.
	head := get(http.MethodHead, "/")
	headBody, _ := io.ReadAll(head.Body)
	if head.StatusCode != http.StatusOK || len(headBody) != 0 || head.Header.Get("Content-Length") != resp.Header.Get("Content-Length") {
		t.Errorf("HEAD / = %d, %d byte, Content-Length %q", head.StatusCode, len(headBody), head.Header.Get("Content-Length"))
	}

	// Halaman lain tidak diolah.
	other := get(http.MethodGet, "/notes/")
	otherBody, _ := io.ReadAll(other.Body)
	if strings.Contains(string(otherBody), "<!-- bisnis -->") {
		t.Errorf("halaman selain / ikut diolah: %q", otherBody)
	}
}

func TestMutatingMethodOnFrontendIsNotAllowed(t *testing.T) {
	resp := serve(t, builtFrontend(), http.MethodPost, "/", nil)
	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf("POST / = %d, want 405", resp.StatusCode)
	}
}

func TestEveryResponseCarriesRequestID(t *testing.T) {
	a := serve(t, builtFrontend(), http.MethodGet, "/", nil).Header.Get("X-Request-Id")
	b := serve(t, builtFrontend(), http.MethodGet, "/", nil).Header.Get("X-Request-Id")
	if !strings.HasPrefix(a, "req_") || !strings.HasPrefix(b, "req_") {
		t.Fatalf("X-Request-Id = %q, %q", a, b)
	}
	if a == b {
		t.Errorf("dua permintaan mendapat id yang sama: %q", a)
	}
}

func TestPanicBecomes500Envelope(t *testing.T) {
	h := withRequestID(withRecover(discard)(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("rusak")
	})))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	resp := rec.Result()

	if resp.StatusCode != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", resp.StatusCode)
	}
	env := decodeEnvelope(t, resp)
	if env.Error.Code != apperr.CodeInternalError {
		t.Errorf("code = %q", env.Error.Code)
	}
	if strings.Contains(env.Error.Message, "rusak") {
		t.Errorf("isi panic bocor ke pengguna: %q", env.Error.Message)
	}
	if env.Error.RequestID != resp.Header.Get("X-Request-Id") {
		t.Errorf("request_id %q tidak sama dengan header", env.Error.RequestID)
	}
}

func decodeEnvelope(t *testing.T, resp *http.Response) errorEnvelope {
	t.Helper()
	if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Fatalf("Content-Type = %q, want JSON", ct)
	}
	var env errorEnvelope
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		t.Fatal(err)
	}
	return env
}
