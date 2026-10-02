package httpx

import (
	"net"
	"net/http"
	"net/netip"
	"strings"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/ratelimit"
)

// Batas laju per kelompok endpoint. Tiga kelompok, tiga alasan yang berbeda —
// dan alasannya yang menentukan angkanya, bukan sebaliknya.
//
// Seluruhnya JAUH di atas kecepatan manusia. Yang dijaga bukan orang yang
// bekerja cepat, melainkan client yang macet mengulang dan skrip penebak.
// Batas yang mengenai pekerjaan normal membuat orang berhenti memakai
// aplikasinya, dan itu kerugian yang jauh lebih besar daripada beban yang
// dihemat.
var (
	// Login. Kuncinya IP — sesi belum ada saat permintaan tiba.
	//
	// Angkanya jauh lebih longgar daripada yang biasa dipakai untuk "batasi
	// percobaan sandi", dan itu DISENGAJA: produk tidak memegang sandi sama
	// sekali. GONSU yang memverifikasinya, dan pembatasan per AKUN beserta
	// backoff progresifnya berada di sana — produk baru mengetahui akunnya
	// SESUDAH token diverifikasi.
	//
	// Yang lebih menentukan angkanya: pada pemasangan di belakang reverse
	// proxy tanpa `APP_TRUSTED_PROXIES`, SELURUH kantor tampak datang dari
	// satu alamat. Tiga puluh orang masuk dalam beberapa menit di pagi hari
	// adalah pemakaian normal, dan pembatas yang menolaknya berarti kantor
	// tidak dapat mulai bekerja.
	//
	// Tiga puluh sekaligus, lalu satu per detik.
	loginRule = ratelimit.Rule{Rate: 1, Burst: 30}

	// Pembuatan data: mutasi ber-`Idempotency-Key`. Tombol yang ditekan
	// berkali-kali sudah dijaga idempotensinya; batas ini menjaga client yang
	// membuat data dengan kunci BERBEDA dalam putaran tanpa henti.
	createRule = ratelimit.Rule{Rate: 1, Burst: 20}

	// Mutasi lain — ubah, hapus, simpan pengaturan. Tanpa kelompok ini
	// endpoint mutasi lain tidak terjaga sama sekali, sementara batas yang
	// cukup longgar tidak pernah menyentuh manusia.
	writeRule = ratelimit.Rule{Rate: 5, Burst: 60}
)

// Limits adalah seluruh pembatas satu proses. Dibuat sekali saat start;
// state-nya in-process.
//
// Kelompok baru ditambahkan bila sebuah jalur punya pola pemakaian yang
// berbeda — misalnya kotak pencarian yang dipanggil setiap ketikan, atau
// pemindai barcode yang mengirim satu permintaan per barang. Tambahkan
// pembatasnya di sini, kelompokkan jalurnya di pick, dan tulis alasannya
// di samping angkanya.
type Limits struct {
	Login  *ratelimit.Limiter
	Create *ratelimit.Limiter
	Write  *ratelimit.Limiter
}

func NewLimits() *Limits {
	return &Limits{
		Login:  ratelimit.New(loginRule),
		Create: ratelimit.New(createRule),
		Write:  ratelimit.New(writeRule),
	}
}

// pick memilih pembatas untuk satu permintaan, beserta pesan penolakannya.
// Nil berarti tidak dibatasi.
func (l *Limits) pick(r *http.Request) (*ratelimit.Limiter, string) {
	switch {
	case r.Method == http.MethodGet || r.Method == http.MethodHead:
		// Pembacaan tidak dibatasi: tidak ada jalur baca yang membuat sesuatu
		// maupun yang dapat dipakai menebak.
		return nil, ""
	case r.Header.Get("Idempotency-Key") != "":
		// Kunci idempotensi adalah penanda yang tidak dapat menyimpang: di
		// repo ini ia diwajibkan tepat pada mutasi yang MEMBUAT data.
		// Mendaftar jalurnya satu per satu akan tertinggal pada modul
		// berikutnya; ini tidak.
		//
		// Client yang menghilangkan header itu untuk mengelak justru ditolak
		// handler-nya sebelum satu data pun dibuat.
		return l.Create, "Terlalu banyak data dibuat beruntun. Tunggu sebentar lalu coba lagi."
	default:
		return l.Write, "Terlalu banyak perubahan beruntun. Tunggu sebentar lalu coba lagi."
	}
}

// ByRoute membatasi seluruh API menurut kelompok endpoint-nya.
//
// Dipasang SESUDAH middleware sesi, supaya kuncinya pengguna — bukan IP.
// Satu kantor berbagi satu alamat publik, dan mengunci pada IP di sana berarti
// satu orang yang sibuk memblokir seluruh kantor.
func (l *Limits) ByRoute(key KeyFunc) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			limiter, message := l.pick(r)
			if limiter == nil {
				next.ServeHTTP(w, r)
				return
			}
			if ok, retry := limiter.Allow(key(r)); !ok {
				WriteError(w, r, nil, apperr.RateLimited(message, retry))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// KeyFunc memilih kunci bucket dari sebuah permintaan.
type KeyFunc func(*http.Request) string

// ByIP mengunci pada alamat koneksi langsung, mengabaikan
// `X-Forwarded-For` seluruhnya. Ini yang dipakai bila tidak ada proxy
// tepercaya yang dinyatakan.
func ByIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// TrustedProxies adalah daftar alamat/CIDR reverse proxy yang boleh dipercaya
// menuliskan `X-Forwarded-For`. Kosong berarti tidak ada — header diabaikan
// seluruhnya.
type TrustedProxies []netip.Prefix

// ParseTrustedProxies mengurai daftar dipisah koma berisi alamat tunggal
// (`10.0.0.4`) atau CIDR (`10.0.0.0/24`). Entri yang tidak sah DIABAIKAN,
// tidak menggagalkan start: salah ketik pada variabel ini tidak boleh membuat
// kantor tidak dapat bekerja, dan mengabaikannya jatuh ke arah aman —
// header-nya tidak jadi dipercaya.
func ParseTrustedProxies(raw string) TrustedProxies {
	var out TrustedProxies
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		if p, err := netip.ParsePrefix(part); err == nil {
			out = append(out, p)
			continue
		}
		if a, err := netip.ParseAddr(part); err == nil {
			out = append(out, netip.PrefixFrom(a, a.BitLen()))
		}
	}
	return out
}

func (t TrustedProxies) has(s string) bool {
	a, err := netip.ParseAddr(strings.TrimSpace(s))
	if err != nil {
		return false
	}
	for _, p := range t {
		if p.Contains(a) {
			return true
		}
	}
	return false
}

// ClientIP mengembalikan kunci alamat client untuk jalur yang BELUM punya
// sesi — login — karena di sana tidak ada identitas lain yang dapat dipercaya.
//
// Daftar ALAMAT tepercaya, bukan jumlah hop. Keduanya menelusuri rantai dari
// kanan dan sampai pada jawaban yang sama untuk topologi yang tetap; bedanya
// muncul saat panjang rantai BERUBAH — CDN ditambahkan di depan proxy, atau
// satu jalur masuk lewat proxy tambahan dan jalur lain tidak. Hitungan hop
// lalu menunjuk entri yang ditulis client, dan itu arah gagal yang berbahaya.
// Daftar alamat berhenti pada entri pertama yang tidak dikenalinya, berapa pun
// panjang rantainya. (Bentuk ini mengikuti `GONSU_ONE_TRUSTED_PROXIES` di
// GONSU One — dua produk yang sampai pada arah yang sama secara terpisah, lalu
// menyamakan bentuknya.)
//
// Aturannya:
//
//  1. alamat koneksi TCP bukan proxy tepercaya → header TIDAK dibaca
//     sama sekali. Ini yang membuat permintaan yang menembus langsung ke pod
//     tidak dapat memilih kuncinya sendiri;
//  2. rantai ditelusuri DARI KANAN — setiap proxy menambah di ujung kanan,
//     jadi yang paling kiri justru nilai yang dipilih client;
//  3. hop tepercaya dilewati; entri pertama yang BUKAN proxy tepercaya adalah
//     pemanggilnya, dan entri di kirinya tidak pernah dilihat;
//  4. entri yang bukan alamat sah dianggap PEMANGGIL, bukan dilewati —
//     melewatinya berarti mempercayai entri di sebelah kirinya;
//  5. seluruh rantai berisi proxy tepercaya → entri terkiri, karena tidak ada
//     pemanggil lain yang tersisa untuk disebut.
func ClientIP(trusted TrustedProxies) KeyFunc {
	if len(trusted) == 0 {
		return ByIP
	}
	return func(r *http.Request) string {
		peer := ByIP(r)
		if !trusted.has(peer) {
			return peer
		}
		var chain []string
		for _, v := range r.Header.Values("X-Forwarded-For") {
			for _, p := range strings.Split(v, ",") {
				if p = strings.TrimSpace(p); p != "" {
					chain = append(chain, p)
				}
			}
		}
		if len(chain) == 0 {
			return peer
		}
		for i := len(chain) - 1; i >= 0; i-- {
			if !trusted.has(chain[i]) {
				return chain[i]
			}
		}
		return chain[0]
	}
}

// Limit menolak permintaan yang melewati batas.
//
// Ia dipasang SESUDAH middleware sesi pada jalur yang punya sesi, supaya
// kuncinya pengguna — bukan IP. Satu kantor berbagi satu alamat publik, dan
// mengunci pada IP di sana berarti satu orang yang sibuk memblokir seluruh
// kantor.
func Limit(l *ratelimit.Limiter, key KeyFunc, message string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ok, retry := l.Allow(key(r))
			if !ok {
				WriteError(w, r, nil, apperr.RateLimited(message, retry))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
