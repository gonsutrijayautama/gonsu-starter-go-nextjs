package pageai

import (
	"encoding/json"
	"strings"
	"testing"
)

// feedAll mengalirkan teks dalam potongan sebesar size byte, seperti jawaban
// model yang tiba sedikit demi sedikit.
func feedAll(text string, size int) []string {
	var (
		parser objects
		out    []string
	)
	for len(text) > 0 {
		n := min(size, len(text))
		for _, raw := range parser.feed(text[:n]) {
			out = append(out, string(raw))
		}
		text = text[n:]
	}
	return out
}

// Objek ditemukan apa pun bungkusnya, dan di mana pun potongan alirannya jatuh.
func TestObjectsAreCutFromAnyWrapping(t *testing.T) {
	tests := []struct {
		name string
		text string
		want []string
	}{
		{"satu per baris", "{\"op\":\"clear\"}\n{\"op\":\"say\",\"text\":\"halo\"}\n", []string{`{"op":"clear"}`, `{"op":"say","text":"halo"}`}},
		{"pagar kode dan kalimat pembuka", "Berikut hasilnya:\n```json\n{\"op\":\"clear\"}\n```\nSemoga membantu.", []string{`{"op":"clear"}`}},
		{"dibungkus daftar", `[{"op":"clear"}, {"op":"remove","ref":"s1"}]`, []string{`{"op":"clear"}`, `{"op":"remove","ref":"s1"}`}},
		{"beberapa baris", "{\n  \"op\": \"insert\",\n  \"item\": { \"type\": \"Hero\" }\n}", []string{"{\n  \"op\": \"insert\",\n  \"item\": { \"type\": \"Hero\" }\n}"}},
		{"kurung dan kutip di dalam teks", `{"op":"say","text":"pakai } dan { serta \"kutip\" \\"}{"op":"clear"}`,
			[]string{`{"op":"say","text":"pakai } dan { serta \"kutip\" \\"}`, `{"op":"clear"}`}},
		{"huruf berbyte banyak", `{"op":"say","text":"Rp25.000 — “enak” 🍜"}`, []string{`{"op":"say","text":"Rp25.000 — “enak” 🍜"}`}},
		{"belum ditutup", `{"op":"say","text":"terpot`, nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			for _, size := range []int{1, 3, 7, len(tt.text)} {
				got := feedAll(tt.text, size)
				if strings.Join(got, "|") != strings.Join(tt.want, "|") {
					t.Errorf("potongan %d byte: %q, want %q", size, got, tt.want)
				}
			}
		})
	}
}

// Kurung yang tidak pernah ditutup tidak membuat penampungnya tumbuh terus,
// dan perintah sesudahnya tetap terbaca.
func TestObjectsGiveUpOnRunawayObject(t *testing.T) {
	var parser objects
	if got := parser.feed(`{"op":"say","text":"` + strings.Repeat("a", maxObject+10)); len(got) != 0 {
		t.Fatalf("objek tak selesai dikembalikan: %d", len(got))
	}
	if cap(parser.buf) > 2*maxObject || parser.depth != 0 {
		t.Errorf("penampung tidak dilepas: cap %d, depth %d", cap(parser.buf), parser.depth)
	}
	got := parser.feed(`{"op":"clear"}`)
	if len(got) != 1 || string(got[0]) != `{"op":"clear"}` {
		t.Errorf("perintah sesudahnya = %q", got)
	}
}

func TestTranslate(t *testing.T) {
	refs := map[string]bool{"s1": true, "s2": true}
	tests := []struct {
		name string
		raw  string
		want string
	}{
		{"clear", `{"op":"clear"}`, `[{"type":"clear"}]`},
		{"remove", `{"op":"remove","ref":"s2"}`, `[{"type":"remove","ref":"s2"}]`},
		{"remove rujukan tak dikenal", `{"op":"remove","ref":"s9"}`, `null`},
		{"update", `{"op":"update","ref":"s1","props":{"title":"Baru"}}`, `[{"type":"update","ref":"s1","props":{"title":"Baru"}}]`},
		{"update tanpa isian", `{"op":"update","ref":"s1"}`, `null`},
		{"update rujukan tak dikenal", `{"op":"update","ref":"s3","props":{}}`, `null`},
		{"insert", `{"op":"insert","before":"end","item":{"type":"Faq","props":{"title":"Tanya jawab"}}}`,
			`[{"type":"insert","item":{"type":"Faq","props":{"title":"Tanya jawab"}}}]`},
		{"insert di atas bagian", `{"op":"insert","before":"s2","item":{"type":"Faq","props":{}}}`,
			`[{"type":"insert","before":"s2","item":{"type":"Faq","props":{}}}]`},
		// Rujukan yang salah tidak membuang bagiannya: ditaruh di paling bawah.
		{"insert di atas rujukan tak dikenal", `{"op":"insert","before":"s7","item":{"type":"Faq","props":{}}}`,
			`[{"type":"insert","item":{"type":"Faq","props":{}}}]`},
		{"insert tanpa jenis blok", `{"op":"insert","item":{"props":{}}}`, `null`},
		{"insert dengan blok sejajar perintahnya", `{"op":"insert","type":"Faq","props":{"title":"T"}}`,
			`[{"type":"insert","item":{"props":{"title":"T"},"type":"Faq"}}]`},
		{"say", `{"op":"say","text":"  Sudah saya ubah.  "}`, `[{"type":"text","text":"Sudah saya ubah."}]`},
		{"say kosong", `{"op":"say","text":"  "}`, `null`},
		{"type di tempat op", `{"type":"remove","ref":"s1"}`, `[{"type":"remove","ref":"s1"}]`},
		{"blok tanpa perintah", `{"type":"Hero","props":{"title":"Halo"}}`, `[{"type":"insert","item":{"type":"Hero","props":{"title":"Halo"}}}]`},
		{"seluruh halaman", `{"content":[{"type":"Hero","props":{}},{"salah":1},{"type":"Faq","props":{}}]}`,
			`[{"type":"insert","item":{"type":"Hero","props":{}}},{"type":"insert","item":{"type":"Faq","props":{}}}]`},
		// Dua perintah menyatu dalam satu objek: keduanya dipakai, berurutan.
		{"perintah menyatu", `{"op":"insert","before":"s2","item":{"type":"Faq","props":{}},"op":"say","text":"Sudah saya tambahkan."}`,
			`[{"type":"insert","before":"s2","item":{"type":"Faq","props":{}}},{"type":"text","text":"Sudah saya tambahkan."}]`},
		{"tiga perintah menyatu", `{"op":"remove","ref":"s1","op":"update","ref":"s2","props":{"title":"T"},"op":"clear"}`,
			`[{"type":"remove","ref":"s1"},{"type":"update","ref":"s2","props":{"title":"T"}},{"type":"clear"}]`},
		{"perintah tak dikenal", `{"op":"jalankan","text":"rm -rf"}`, `null`},
		{"bukan JSON", `{hasil}`, `null`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := json.Marshal(translate([]byte(tt.raw), refs))
			if err != nil || string(got) != tt.want {
				t.Errorf("translate(%s) = %s, %v; want %s", tt.raw, got, err, tt.want)
			}
		})
	}
}

// Kalimat untuk pengguna dipotong per karakter, bukan per byte.
func TestTranslateCapsSay(t *testing.T) {
	raw, _ := json.Marshal(map[string]string{"op": "say", "text": strings.Repeat("é", maxSay+50)})
	got := translate(raw, nil)
	if len(got) != 1 || len([]rune(got[0].Text)) != maxSay {
		t.Errorf("say panjang = %d kejadian, %d karakter", len(got), len([]rune(got[0].Text)))
	}
}

// Halaman sekarang ditulis satu baris per bagian; bagian yang isiannya tidak
// dikirim layar ditandai terkunci.
func TestPageState(t *testing.T) {
	if got := pageState(nil); !strings.Contains(got, "Halaman masih kosong.") {
		t.Errorf("halaman kosong = %q", got)
	}
	got := pageState([]Section{
		{Ref: "s1", Type: "Hero", Props: json.RawMessage(`{ "title": "Roti <hangat> & kopi" }`)},
		{Ref: "s2", Type: "CustomSection", Props: json.RawMessage(`null`)},
	})
	for _, want := range []string{
		`{"ref":"s1","type":"Hero","props":{"title":"Roti <hangat> & kopi"}}`,
		`{"ref":"s2","type":"CustomSection","locked":true}`,
	} {
		if !strings.Contains(got, want) {
			t.Errorf("pageState tidak memuat %s:\n%s", want, got)
		}
	}
}
