package ratelimit

import (
	"sync"
	"testing"
	"time"
)

// clock palsu: waktu adalah satu-satunya masukan pembatas ini selain kuncinya,
// dan tes yang menunggu waktu sungguhan akan lambat DAN rapuh.
type clock struct{ t time.Time }

func (c *clock) now() time.Time { return c.t }

func fixed(rule Rule) (*Limiter, *clock) {
	c := &clock{t: time.Unix(1_700_000_000, 0)}
	l := New(rule)
	l.now = c.now
	return l, c
}

func TestBurstThenRejected(t *testing.T) {
	l, _ := fixed(Rule{Rate: 1, Burst: 3})
	for i := range 3 {
		if ok, _ := l.Allow("a"); !ok {
			t.Fatalf("permintaan ke-%d ditolak padahal masih dalam burst", i+1)
		}
	}
	ok, retry := l.Allow("a")
	if ok {
		t.Fatal("permintaan keempat diterima padahal burst habis")
	}
	// Menolak tanpa menyebut kapan boleh kembali membuat client mencoba
	// terus — dan pembatas yang memperbanyak permintaan adalah pembatas
	// yang gagal.
	if retry <= 0 {
		t.Errorf("retry = %v, ingin lebih dari nol", retry)
	}
}

func TestRecoversOverTime(t *testing.T) {
	l, c := fixed(Rule{Rate: 2, Burst: 2})
	l.Allow("a")
	l.Allow("a")
	if ok, _ := l.Allow("a"); ok {
		t.Fatal("diterima padahal burst habis")
	}
	// Setengah detik pada 2/detik = tepat satu token.
	c.t = c.t.Add(500 * time.Millisecond)
	if ok, _ := l.Allow("a"); !ok {
		t.Error("ditolak padahal satu token seharusnya sudah pulih")
	}
	if ok, _ := l.Allow("a"); ok {
		t.Error("diterima dua kali padahal hanya satu token yang pulih")
	}
}

// Kunci yang berbeda tidak saling menghabiskan. Kalau tidak, satu client yang
// macet akan mengunci seluruh kantor — persis kebalikan dari yang diinginkan.
func TestSeparateKeys(t *testing.T) {
	l, _ := fixed(Rule{Rate: 1, Burst: 1})
	if ok, _ := l.Allow("user-1"); !ok {
		t.Fatal("user-1 ditolak pada permintaan pertamanya")
	}
	if ok, _ := l.Allow("user-2"); !ok {
		t.Fatal("user-2 ikut ditolak karena user-1 memakai jatahnya")
	}
	if ok, _ := l.Allow("user-1"); ok {
		t.Error("user-1 diterima dua kali")
	}
}

// Token tidak menumpuk melewati burst. Tanpa batas atas, pemasangan yang
// menganggur semalaman akan memberi seribu permintaan sekaligus di pagi hari —
// dan justru pagi hari itulah bebannya paling berat.
func TestTokensDoNotExceedBurst(t *testing.T) {
	l, c := fixed(Rule{Rate: 10, Burst: 5})
	c.t = c.t.Add(time.Hour)
	for i := range 5 {
		if ok, _ := l.Allow("a"); !ok {
			t.Fatalf("permintaan ke-%d ditolak padahal burst penuh", i+1)
		}
	}
	if ok, _ := l.Allow("a"); ok {
		t.Error("token menumpuk melewati burst")
	}
}

// `Retry-After` berbutir detik, jadi nilainya dibulatkan KE ATAS: membulatkan
// ke bawah menyuruh client kembali sebelum tokennya benar-benar ada, dan ia
// akan ditolak lagi.
func TestRetryIsRoundedUp(t *testing.T) {
	l, _ := fixed(Rule{Rate: 0.5, Burst: 1})
	l.Allow("a")
	_, retry := l.Allow("a")
	if retry != 2*time.Second {
		t.Errorf("retry = %v, ingin 2s (1 token pada 0,5/detik)", retry)
	}
}

// Bucket yang menganggur dibuang. Tanpa ini peta tumbuh sebesar jumlah
// pengguna dikali umur pod — kebocoran yang baru terasa pada pemasangan yang
// paling lama hidup, yaitu yang paling tidak ingin kita ganggu.
func TestIdleBucketsAreDropped(t *testing.T) {
	l, c := fixed(Rule{Rate: 1, Burst: 1})
	for _, k := range []string{"a", "b", "c"} {
		l.Allow(k)
	}
	if l.Len() != 3 {
		t.Fatalf("bucket = %d, ingin 3", l.Len())
	}
	c.t = c.t.Add(l.idle + time.Second)
	l.Allow("d")
	if l.Len() != 1 {
		t.Errorf("bucket sesudah menganggur = %d, ingin 1 (hanya \"d\")", l.Len())
	}
}

// Pembersihan tidak boleh membuang bucket yang masih MENAHAN seseorang —
// itu akan memberi penyerang jatah baru dengan cara menunggu.
func TestSweepKeepsLimitedKeys(t *testing.T) {
	l, c := fixed(Rule{Rate: 1, Burst: 1})
	l.Allow("penyerang")
	// Maju separuh dari ambang menganggur: belum cukup untuk dibuang, dan
	// pada Rate 1 dengan Burst 1 tokennya memang sudah pulih penuh.
	c.t = c.t.Add(l.idle / 2)
	l.Allow("orang-lain")
	if l.Len() != 2 {
		t.Fatalf("bucket = %d, ingin 2 — pembersihan terlalu rakus", l.Len())
	}
}

func TestSafeForConcurrentUse(t *testing.T) {
	l := New(Rule{Rate: 1000, Burst: 1000})
	var wg sync.WaitGroup
	for i := range 50 {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			for range 20 {
				l.Allow("k" + string(rune('a'+i%5)))
			}
		}(i)
	}
	wg.Wait()
	if l.Len() != 5 {
		t.Errorf("bucket = %d, ingin 5", l.Len())
	}
}
