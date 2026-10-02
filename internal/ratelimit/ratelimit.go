// Package ratelimit adalah pembatas laju in-process.
//
// Pembatas laju dibutuhkan sejak awal, tidak menunggu Redis. Bentuknya token
// bucket per instance, pindah ke store terpusat hanya bila multi-instance
// membuktikan kebutuhan. Pemasangan produk hari ini
// satu instance (chart GONSU `replicas: 1`), jadi "per instance" dan "per
// pemasangan" adalah hal yang sama — dan menambah Redis untuk menyamakan
// keduanya berarti satu komponen lagi yang harus hidup di self-host demi
// perbedaan yang belum ada.
//
// Yang dijaga BUKAN pemakaian cepat oleh manusia. Orang yang mengisi puluhan
// data berturut-turut sedang bekerja; yang dijaga adalah client macet yang
// mengulang, skrip penebak, dan kotak pencarian yang memanggil server tiap
// ketikan. Karena itu setiap batas di sini jauh di atas kecepatan manusia,
// dan angkanya diturunkan dari alasannya — bukan sebaliknya.
package ratelimit

import (
	"math"
	"sync"
	"time"
)

// Rule adalah satu batas: berapa permintaan per satuan waktu, dan seberapa
// besar ledakan yang dimaafkan.
//
// `Burst` bukan hiasan. Pekerjaan nyata datang bergerombol — dua puluh data
// dimasukkan dalam beberapa detik lalu berhenti semenit — dan pembatas tanpa
// burst menolak gerombolan yang justru bentuk pekerjaan normalnya.
type Rule struct {
	// Rate adalah permintaan per detik yang dipulihkan.
	Rate float64
	// Burst adalah jumlah permintaan yang dapat menumpuk saat menganggur.
	Burst float64
}

// Limiter adalah kumpulan bucket ber-kunci. Aman dipakai bersamaan.
type Limiter struct {
	rule Rule
	// idle adalah berapa lama bucket yang tidak tersentuh dibuang. Tanpa ini
	// peta tumbuh sebesar jumlah pengguna × umur pod — kebocoran memori yang
	// baru terasa pada pemasangan yang paling lama hidup, yaitu yang paling
	// tidak ingin kita ganggu.
	idle time.Duration
	now  func() time.Time

	mu      sync.Mutex
	buckets map[string]*bucket
	// sweepAt adalah kapan pembersihan berikutnya boleh berjalan. Pembersihan
	// menumpang pada permintaan yang lewat, bukan pada goroutine sendiri:
	// aplikasi ini tidak punya penjadwal, dan menambah satu hanya untuk
	// membersihkan peta berarti satu hal lagi yang harus dimatikan dengan
	// benar saat pod berhenti.
	sweepAt time.Time
}

type bucket struct {
	tokens float64
	seen   time.Time
}

// idleFactor menentukan berapa lama bucket menganggur disimpan: cukup untuk
// mengisi ulang penuh, lalu dilipatkan supaya pembersihan tidak menghapus
// bucket yang masih menahan seseorang. Bucket yang sudah penuh tidak menahan
// siapa pun, jadi membuangnya tidak mengubah keputusan apa pun.
const idleFactor = 4

// New membuat pembatas dengan aturan yang diberikan.
func New(rule Rule) *Limiter {
	if rule.Rate <= 0 {
		panic("ratelimit: Rate harus lebih dari nol")
	}
	if rule.Burst < 1 {
		rule.Burst = 1
	}
	idle := time.Duration(float64(time.Second) * rule.Burst / rule.Rate * idleFactor)
	if idle < time.Minute {
		idle = time.Minute
	}
	return &Limiter{rule: rule, idle: idle, now: time.Now, buckets: map[string]*bucket{}}
}

// Allow mengambil satu token untuk `key`.
//
// Bila ditolak, `retry` menyebut berapa lama sampai satu token tersedia —
// itulah yang menjadi `Retry-After`. Menolak tanpa menyebut
// kapan boleh mencoba lagi membuat client mencoba terus, dan pembatas yang
// justru memperbanyak permintaan adalah pembatas yang gagal.
func (l *Limiter) Allow(key string) (ok bool, retry time.Duration) {
	now := l.now()

	l.mu.Lock()
	defer l.mu.Unlock()

	l.sweepLocked(now)

	b, present := l.buckets[key]
	if !present {
		b = &bucket{tokens: l.rule.Burst}
		l.buckets[key] = b
	} else {
		b.tokens = math.Min(l.rule.Burst,
			b.tokens+now.Sub(b.seen).Seconds()*l.rule.Rate)
	}
	b.seen = now

	if b.tokens < 1 {
		// Dibulatkan KE ATAS ke detik penuh: `Retry-After` berbutir detik,
		// dan membulatkan ke bawah menyuruh client kembali sebelum tokennya
		// benar-benar ada.
		lacking := 1 - b.tokens
		secs := math.Ceil(lacking / l.rule.Rate)
		return false, time.Duration(secs) * time.Second
	}
	b.tokens--
	return true, 0
}

// sweepLocked membuang bucket yang lama tidak tersentuh. Dipanggil dengan
// mu terkunci.
func (l *Limiter) sweepLocked(now time.Time) {
	if now.Before(l.sweepAt) {
		return
	}
	l.sweepAt = now.Add(l.idle)
	for k, b := range l.buckets {
		if now.Sub(b.seen) > l.idle {
			delete(l.buckets, k)
		}
	}
}

// Len melaporkan berapa bucket yang sedang disimpan. Untuk tes dan metrik.
func (l *Limiter) Len() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.buckets)
}
