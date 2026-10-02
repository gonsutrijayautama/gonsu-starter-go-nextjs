package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func req(method, path string, header map[string]string) *http.Request {
	r := httptest.NewRequest(method, path, nil)
	for k, v := range header {
		r.Header.Set(k, v)
	}
	return r
}

// Klasifikasi adalah kebijakannya. Yang paling mahal bila salah: pembacaan
// ikut dibatasi, sehingga layar yang menyegarkan diri berhenti bekerja.
func TestEndpointClassification(t *testing.T) {
	l := NewLimits()
	idem := map[string]string{"Idempotency-Key": "k"}

	tests := []struct {
		name string
		r    *http.Request
		want string
	}{
		{"create note", req("POST", "/v1/notes", idem), "create"},
		{"update note", req("PUT", "/v1/notes/7", nil), "write"},
		{"delete note", req("DELETE", "/v1/notes/7", nil), "write"},
		{"change access", req("PATCH", "/v1/users/7", nil), "write"},
		{"list notes", req("GET", "/v1/notes", nil), "none"},
		{"read note", req("GET", "/v1/notes/7", nil), "none"},
	}

	for _, tt := range tests {
		got, _ := l.pick(tt.r)
		var label string
		switch got {
		case nil:
			label = "none"
		case l.Create:
			label = "create"
		case l.Write:
			label = "write"
		}
		if label != tt.want {
			t.Errorf("%s: %s %s → %s, ingin %s", tt.name, tt.r.Method, tt.r.URL.Path, label, tt.want)
		}
	}
}

// Tanpa proxy tepercaya: `X-Forwarded-For` diabaikan SELURUHNYA. Pembatas
// yang dapat dilewati dengan satu header lebih buruk daripada tidak ada,
// karena ia terlihat seperti perlindungan.
func TestClientIPWithoutTrustedProxies(t *testing.T) {
	key := ClientIP(nil)
	r := httptest.NewRequest("GET", "/auth/gonsu/callback", nil)
	r.RemoteAddr = "10.0.0.7:51234"
	r.Header.Set("X-Forwarded-For", "1.2.3.4")
	if got := key(r); got != "10.0.0.7" {
		t.Errorf("kunci = %q, ingin alamat koneksi 10.0.0.7", got)
	}
}

// Alamat koneksi yang BUKAN proxy tepercaya: header tidak dibaca sama sekali.
// Inilah yang menutup jalur "kirim langsung ke pod, lewati proxy" — permintaan
// semacam itu tidak boleh memilih kuncinya sendiri.
func TestClientIPUntrustedPeer(t *testing.T) {
	key := ClientIP(ParseTrustedProxies("10.0.0.1"))
	r := httptest.NewRequest("GET", "/auth/gonsu/callback", nil)
	r.RemoteAddr = "192.0.2.50:40000"
	r.Header.Set("X-Forwarded-For", "1.2.3.4")
	if got := key(r); got != "192.0.2.50" {
		t.Errorf("kunci = %q, ingin alamat koneksi 192.0.2.50", got)
	}
}

// Satu proxy tepercaya: rantai ditelusuri DARI KANAN, dan entri pertama yang
// bukan proxy tepercaya adalah pemanggilnya.
func TestClientIPOneTrustedProxy(t *testing.T) {
	key := ClientIP(ParseTrustedProxies("10.0.0.1/32"))
	r := httptest.NewRequest("GET", "/auth/gonsu/callback", nil)
	r.RemoteAddr = "10.0.0.1:51234"
	r.Header.Set("X-Forwarded-For", "203.0.113.5")
	if got := key(r); got != "203.0.113.5" {
		t.Errorf("kunci = %q, ingin 203.0.113.5", got)
	}

	// Penyerang yang menyuntikkan alamat palsu hanya menambah entri di KIRI.
	// Kalau yang dibaca paling kiri — cara yang paling sering ditulis orang —
	// setiap permintaan dapat memilih bucket-nya sendiri, dan pembatasnya
	// tidak membatasi apa pun.
	r.Header.Set("X-Forwarded-For", "6.6.6.6, 7.7.7.7, 203.0.113.5")
	if got := key(r); got != "203.0.113.5" {
		t.Errorf("kunci dengan entri palsu = %q, ingin tetap 203.0.113.5", got)
	}
}

// Rantai lebih panjang daripada yang diperkirakan — CDN ditambahkan di depan
// proxy — tetap menghasilkan pemanggil yang benar. Inilah yang tidak dapat
// dilakukan hitungan hop: `n` yang benar sebelum CDN menjadi salah sesudahnya,
// dan salahnya menunjuk entri yang ditulis client.
func TestClientIPLongChainWithSeveralTrustedProxies(t *testing.T) {
	key := ClientIP(ParseTrustedProxies("10.0.0.0/24, 172.16.0.5"))
	r := httptest.NewRequest("GET", "/auth/gonsu/callback", nil)
	r.RemoteAddr = "10.0.0.9:51234"
	r.Header.Set("X-Forwarded-For", "9.9.9.9, 203.0.113.5, 172.16.0.5, 10.0.0.3")
	if got := key(r); got != "203.0.113.5" {
		t.Errorf("kunci = %q, ingin 203.0.113.5", got)
	}
}

// Entri yang BUKAN alamat sah dianggap pemanggil, bukan dilewati. Melewatinya
// berarti mempercayai entri di sebelah kirinya — yang justru ditulis client.
func TestClientIPDoesNotSkipInvalidEntries(t *testing.T) {
	key := ClientIP(ParseTrustedProxies("10.0.0.0/24"))
	r := httptest.NewRequest("GET", "/auth/gonsu/callback", nil)
	r.RemoteAddr = "10.0.0.9:51234"
	r.Header.Set("X-Forwarded-For", "203.0.113.5, bukan-alamat, 10.0.0.3")
	if got := key(r); got != "bukan-alamat" {
		t.Errorf("kunci = %q, ingin \"bukan-alamat\" — entri tak sah tidak boleh dilewati", got)
	}
}

// Seluruh rantai berisi proxy tepercaya: entri terkiri, karena tidak ada
// pemanggil lain yang tersisa untuk disebut.
func TestClientIPWholeChainTrusted(t *testing.T) {
	key := ClientIP(ParseTrustedProxies("10.0.0.0/24"))
	r := httptest.NewRequest("GET", "/auth/gonsu/callback", nil)
	r.RemoteAddr = "10.0.0.9:51234"
	r.Header.Set("X-Forwarded-For", "10.0.0.2, 10.0.0.3")
	if got := key(r); got != "10.0.0.2" {
		t.Errorf("kunci = %q, ingin 10.0.0.2 (terkiri)", got)
	}
}

// Tanpa header sama sekali: alamat koneksi.
func TestClientIPWithoutHeader(t *testing.T) {
	key := ClientIP(ParseTrustedProxies("10.0.0.0/24"))
	r := httptest.NewRequest("GET", "/auth/gonsu/callback", nil)
	r.RemoteAddr = "10.0.0.9:51234"
	if got := key(r); got != "10.0.0.9" {
		t.Errorf("kunci = %q, ingin 10.0.0.9", got)
	}
}

// Entri konfigurasi yang tidak sah DIABAIKAN, tidak menggagalkan start dan
// tidak membuatnya mempercayai apa pun. Salah ketik jatuh ke arah aman.
func TestParseTrustedProxiesIgnoresInvalid(t *testing.T) {
	got := ParseTrustedProxies("10.0.0.1, bukan-alamat, , 172.16.0.0/12, 999.999.999.999")
	if len(got) != 2 {
		t.Fatalf("terurai %d entri, ingin 2: %v", len(got), got)
	}
	if !got.has("10.0.0.1") || !got.has("172.16.5.5") {
		t.Errorf("daftar = %v, tidak memuat yang seharusnya", got)
	}
	if got.has("192.0.2.1") {
		t.Error("daftar memuat alamat yang tidak disebut")
	}
}

// 429 WAJIB membawa `Retry-After`. Menolak tanpa menyebut
// kapan boleh kembali membuat client mencoba terus.
func TestRejectionCarriesRetryAfter(t *testing.T) {
	l := NewLimits()
	h := l.ByRoute(ByIP)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	var last *httptest.ResponseRecorder
	// Burst pembuatan 20; permintaan ke-21 pasti ditolak.
	for range 21 {
		r := req("POST", "/v1/notes", map[string]string{"Idempotency-Key": "k"})
		r.RemoteAddr = "10.0.0.9:1"
		last = httptest.NewRecorder()
		h.ServeHTTP(last, r)
	}
	if last.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d, ingin 429", last.Code)
	}
	if last.Header().Get("Retry-After") == "" {
		t.Error("429 tanpa Retry-After")
	}
	if !contains(last.Body.String(), "RATE_LIMITED") {
		t.Errorf("body tidak menyebut RATE_LIMITED: %s", last.Body.String())
	}
}

// Pembacaan tidak dibatasi: layar yang menyegarkan dirinya sendiri tidak
// boleh berhenti memperbarui diri.
func TestReadsAreNotLimited(t *testing.T) {
	l := NewLimits()
	h := l.ByRoute(ByIP)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	for i := range 500 {
		r := req("GET", "/v1/notes", nil)
		r.RemoteAddr = "10.0.0.9:1"
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != http.StatusOK {
			t.Fatalf("pembacaan ke-%d ditolak dengan %d", i+1, w.Code)
		}
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
