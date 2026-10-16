// Package pageai adalah asisten AI di penyusun halaman: permintaan pengguna
// dan isi halaman dikirim ke model bahasa, dan jawabannya dialirkan ke layar
// sebagai perintah yang mengubah halaman (ops.go).
//
// PERCOBAAN. Kunci API tinggal di server; layar tidak pernah melihatnya.
// Aturan desain dan katalog blok datang dari layar (`guide`), karena katalog
// itu dibaca dari konfigurasi editor di web/. Akibatnya pengguna yang berizin
// bisa menulis `guide` sendiri — sebelum fitur ini keluar dari percobaan,
// katalognya harus pindah ke server.
package pageai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authn"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authz"
)

const (
	// Vercel AI Gateway; alamat lain yang berbicara API chat completions ala
	// OpenAI bisa dipakai lewat APP_AI_BASE_URL.
	defaultBaseURL = "https://ai-gateway.vercel.sh/v1"
	// DefaultModel: kandidat terkuat untuk menyusun dari blok pada uji
	// 2026-10-04 — jawaban 4–10 detik dengan biaya paling kecil.
	DefaultModel = "google/gemini-2.5-flash-lite"

	maxPrompt   = 2000
	maxGuide    = 200 << 10
	maxSections = 60
	maxHistory  = 12
	maxTurn     = 2000
	// maxOutputTokens: halaman 9 bagian butuh sekitar 6 ribu token; sisanya
	// ruang untuk model yang berpikir dulu sebelum menjawab.
	maxOutputTokens = 16000
	// replyTimeout: model besar menyusun satu halaman dalam 1–2 menit.
	replyTimeout = 3 * time.Minute
)

const instructions = `Kamu asisten di dalam editor halaman web milik sebuah usaha kecil di Indonesia: desainer web sekaligus penulis iklan berpengalaman. Pengguna mengobrol denganmu, dan tugasmu mengubah halaman yang sedang dibuka sesuai permintaannya.

## Cara menjawab
Jawabanmu dibaca program, bukan manusia. Tulis HANYA perintah: satu objek JSON per baris, tanpa pagar kode dan tanpa teks lain di luar objek.

{"op":"clear"}
  Kosongkan halaman. Hanya untuk permintaan halaman baru atau menyusun ulang dari awal.
{"op":"insert","before":"s3","item":{"type":"…","props":{…}}}
  Bagian baru tepat di atas bagian s3. "before" wajib ditulis: rujukan bagian yang akan berada persis di bawah bagian baru, atau "end" untuk paling bawah.
{"op":"update","ref":"s2","props":{…}}
  Ubah bagian yang ada. Tulis hanya isian yang berubah; isian lain tetap seperti semula. Daftar ditulis utuh. Untuk appearance cukup isian yang berubah. Isian yang tampil menyambung dengan yang kamu ubah (misalnya "title" dan "highlight" pada satu judul) ikut disesuaikan atau dikosongkan.
{"op":"remove","ref":"s4"}
  Buang bagian.
{"op":"say","text":"…"}
  Kalimat untuk pengguna.

## Aturan
1. Kerjakan yang diminta, tidak lebih. Permintaan kecil (ganti judul, ubah warna, perbaiki kalimat) dijawab dengan "update" pada bagian itu saja, bukan dengan menyusun ulang halaman.
2. Permintaan halaman baru: "clear" bila halaman sudah berisi, lalu "insert" dengan "before":"end" berurutan dari atas ke bawah.
3. Mengganti jenis blok sebuah bagian: "insert" penggantinya dengan "before" bagian lama, lalu "remove" bagian lama.
4. "ref" dan "before" hanya boleh memakai rujukan yang tertulis di "Halaman saat ini". Bagian bertanda "locked" dibuat dengan cara lain: boleh dibuang, tidak bisa diubah.
5. Nilai "gambar:N" adalah foto yang sudah diunggah. Saat menulis ulang daftar yang memuatnya, salin nilainya apa adanya.
6. Jangan mengarang fakta tentang usaha ini: bidang usahanya, nama pelanggan dan ucapannya, rating, jumlah pelanggan, penghargaan, harga, jam buka, nomor telepon, dan alamat hanya ditulis bila ada di data usaha atau disebut pengguna. Bila sebuah bagian membutuhkannya, biarkan isiannya kosong ("" untuk teks, 0 untuk angka, [] untuk daftar jam): editor menandainya sebagai isian yang perlu diisi, dan pengunjung tidak melihat yang kosong. Lalu sebut di "say" bagian mana yang perlu diisi pengguna.
7. Akhiri dengan tepat satu "say": satu atau dua kalimat bahasa Indonesia yang santai, tanpa markdown, tentang apa yang kamu kerjakan dan apa yang perlu diperiksa pengguna.
8. Permintaan yang tidak jelas, atau yang bukan tentang halaman ini: jangan ubah apa pun, jawab dengan satu "say" yang bertanya balik atau menjelaskan apa yang bisa kamu bantu.
9. Bagian yang dimaksud pengguna tidak ada di halaman: jangan membuang atau mengubah bagian lain sebagai gantinya; katakan lewat "say" bahwa bagiannya tidak ada.

Di bawah ini bahan dari editor: data usaha, aturan desain dan isi, dan katalog blok yang boleh dipakai.`

// reminder ditulis sesudah permintaan, bukan hanya di pesan sistem: pada uji
// 2026-10-04 model kecil mengabaikan aturan yang sama selama letaknya jauh
// di atas, di antara katalog blok.
const reminder = `## Periksa sebelum menjawab
- Bidang usaha belum diketahui, baik dari data usaha maupun dari percakapan? Jangan menyusun halaman: jawab dengan satu "say" yang menanyakan apa yang dijual atau dikerjakan usaha ini.
- Bagian yang dimaksud tidak ada di "Halaman saat ini"? Jangan sentuh bagian lain: jawab dengan satu "say".
- Nama pelanggan, ucapan pelanggan, rating, angka capaian, harga, dan jam buka yang tidak tertulis di data usaha atau percakapan dibiarkan kosong ("" atau 0), bukan dikarang dan bukan diisi teks contoh.
- Mengubah judul? Isian "highlight" di bagian yang sama ikut disesuaikan atau dikosongkan.
- Jawab hanya dengan perintah JSON, diakhiri satu "say".`

var (
	errNotConfigured = apperr.AIUnavailable("Asisten AI belum diaktifkan di pemasangan ini.")
	errUnavailable   = apperr.AIUnavailable("AI sedang tidak bisa dihubungi. Coba lagi sebentar lagi.")
	errBusy          = apperr.AIUnavailable("AI sedang sibuk. Tunggu sebentar, lalu coba lagi.")
	errEmpty         = apperr.AIUnavailable("AI tidak memberi jawaban yang bisa dipakai. Coba kirim lagi, atau tulis permintaannya dengan kata lain.")
	errPartial       = apperr.AIUnavailable("Sebagian jawaban AI tidak bisa dibaca, jadi perubahannya mungkin belum lengkap. Periksa hasilnya, atau kirim lagi permintaannya.")
	errTruncated     = apperr.AIUnavailable("Jawaban AI terpotong karena terlalu panjang. Bagian yang sudah tersusun tetap di halaman; minta AI melanjutkan sisanya.")
)

// Turn adalah satu giliran percakapan sebelum permintaan ini.
type Turn struct {
	// Role: "user" atau "assistant".
	Role string `json:"role"`
	Text string `json:"text"`
}

// Section adalah satu bagian halaman saat permintaan dikirim.
type Section struct {
	// Ref: rujukan pendek buatan layar ("s1", "s2", …) yang dipakai model
	// untuk menunjuk bagian ini.
	Ref  string `json:"ref"`
	Type string `json:"type"`
	// Props: isian yang boleh dibaca model. null berarti bagian ini bukan
	// blok yang dikenal AI (misalnya Bagian khusus): boleh dibuang, tidak
	// bisa diubah.
	Props json.RawMessage `json:"props"`
}

// Request adalah satu permintaan ke asisten.
type Request struct {
	Prompt   string    `json:"prompt"`
	History  []Turn    `json:"history"`
	Sections []Section `json:"sections"`
	// Guide: data usaha, aturan desain dan isi, dan katalog blok, disusun
	// layar dari konfigurasi editor (web/components/pages/ai/prompt.ts).
	Guide string `json:"guide"`
}

// Status: apakah asisten AI aktif, dan model yang menjawabnya.
type Status struct {
	Configured bool   `json:"configured"`
	Model      string `json:"model"`
}

// Options: HTTPClient hanya diisi test.
type Options struct {
	APIKey     string
	BaseURL    string
	Model      string
	HTTPClient *http.Client
	Logger     *slog.Logger
}

// Service meneruskan permintaan ke model dan mengurai jawabannya.
type Service struct {
	key    string
	model  string
	base   *url.URL
	client *http.Client
	logger *slog.Logger
}

func NewService(o Options) (*Service, error) {
	base := o.BaseURL
	if base == "" {
		base = defaultBaseURL
	}
	u, err := url.Parse(base)
	if err != nil || u.Host == "" || (u.Scheme != "https" && u.Scheme != "http") {
		return nil, fmt.Errorf("alamat API model AI %q tidak sah", base)
	}
	s := &Service{key: strings.TrimSpace(o.APIKey), model: strings.TrimSpace(o.Model), base: u, client: o.HTTPClient, logger: o.Logger}
	if s.model == "" {
		s.model = DefaultModel
	}
	if s.client == nil {
		// Tanpa batas waktu keseluruhan: jawabannya mengalir, dan lamanya
		// dibatasi replyTimeout. Yang dibatasi di sini hanya menunggu jawaban
		// pertama.
		transport := http.DefaultTransport.(*http.Transport).Clone()
		transport.ResponseHeaderTimeout = time.Minute
		s.client = &http.Client{Transport: transport}
	}
	if s.logger == nil {
		s.logger = slog.Default()
	}
	return s, nil
}

// Configured melaporkan apakah kunci API diisi.
func (s *Service) Configured() bool { return s.key != "" }

// Model adalah model yang menjawab permintaan.
func (s *Service) Model() string { return s.model }

// Status dibaca layar untuk memilih antara asisten sungguhan dan simulasi.
func (s *Service) Status(ctx context.Context) (Status, error) {
	if _, err := authn.Check(ctx, authz.SettingsWebsiteManage); err != nil {
		return Status{}, err
	}
	if !s.Configured() {
		return Status{}, nil
	}
	return Status{Configured: true, Model: s.model}, nil
}

var refPattern = regexp.MustCompile(`^s[1-9][0-9]{0,2}$`)

// validate merapikan permintaan dan mengembalikan rujukan bagian yang sah.
func validate(in *Request) (map[string]bool, error) {
	var details []apperr.FieldError
	in.Prompt = strings.TrimSpace(in.Prompt)
	switch {
	case in.Prompt == "":
		details = append(details, apperr.FieldError{Field: "prompt", Message: "Tulis dulu permintaannya."})
	case utf8.RuneCountInString(in.Prompt) > maxPrompt:
		details = append(details, apperr.FieldError{Field: "prompt", Message: "Paling banyak 2.000 karakter."})
	}
	in.Guide = strings.TrimSpace(in.Guide)
	switch {
	case in.Guide == "":
		details = append(details, apperr.FieldError{Field: "guide", Message: "Katalog blok dari editor wajib disertakan."})
	case len(in.Guide) > maxGuide:
		details = append(details, apperr.FieldError{Field: "guide", Message: "Katalog blok terlalu panjang."})
	}

	refs := make(map[string]bool, len(in.Sections))
	if len(in.Sections) > maxSections {
		details = append(details, apperr.FieldError{Field: "sections", Message: "Halaman ini terlalu panjang untuk dibaca AI: paling banyak 60 bagian."})
	} else {
		for i, section := range in.Sections {
			field := fmt.Sprintf("sections[%d]", i)
			switch {
			case !refPattern.MatchString(section.Ref) || refs[section.Ref]:
				details = append(details, apperr.FieldError{Field: field + ".ref", Message: "Rujukan bagian tidak sah atau dipakai dua kali."})
			case section.Type == "" || len(section.Type) > maxType:
				details = append(details, apperr.FieldError{Field: field + ".type", Message: "Jenis bagian wajib diisi."})
			case len(section.Props) > 0 && !isObject(section.Props) && string(bytes.TrimSpace(section.Props)) != "null":
				details = append(details, apperr.FieldError{Field: field + ".props", Message: "Isian bagian harus berupa objek."})
			}
			refs[section.Ref] = true
		}
	}

	// Percakapan yang panjang dipotong, bukan ditolak: yang terbaru yang
	// menentukan maksud permintaan.
	if len(in.History) > maxHistory {
		in.History = in.History[len(in.History)-maxHistory:]
	}
	history := in.History[:0:0]
	for i, turn := range in.History {
		if turn.Role != "user" && turn.Role != "assistant" {
			details = append(details, apperr.FieldError{Field: fmt.Sprintf("history[%d].role", i), Message: "Giliran percakapan tidak dikenal."})
			continue
		}
		text := strings.TrimSpace(turn.Text)
		if text == "" {
			continue
		}
		if runes := []rune(text); len(runes) > maxTurn {
			text = string(runes[:maxTurn])
		}
		history = append(history, Turn{Role: turn.Role, Text: text})
	}
	in.History = history

	if len(details) > 0 {
		return nil, apperr.Validation("Permintaan ke asisten AI belum lengkap.", details...)
	}
	return refs, nil
}

// compact menulis JSON tanpa mengganti < > & dengan kode: teksnya dibaca
// model, bukan disisipkan ke HTML.
func compact(v any) string {
	var b bytes.Buffer
	enc := json.NewEncoder(&b)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return "{}"
	}
	return strings.TrimSpace(b.String())
}

// pageState menuliskan halaman sekarang: satu baris per bagian.
func pageState(sections []Section) string {
	if len(sections) == 0 {
		return "## Halaman saat ini\nHalaman masih kosong."
	}
	var b strings.Builder
	b.WriteString("## Halaman saat ini\nSatu baris per bagian, dari atas ke bawah.\n")
	for _, section := range sections {
		line := struct {
			Ref    string          `json:"ref"`
			Type   string          `json:"type"`
			Props  json.RawMessage `json:"props,omitempty"`
			Locked bool            `json:"locked,omitempty"`
		}{Ref: section.Ref, Type: section.Type}
		if isObject(section.Props) {
			line.Props = section.Props
		} else {
			line.Locked = true
		}
		b.WriteString(compact(line))
		b.WriteByte('\n')
	}
	return strings.TrimRight(b.String(), "\n")
}

type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func messages(in Request) []message {
	out := []message{{Role: "system", Content: instructions + "\n\n" + in.Guide}}
	for _, turn := range in.History {
		content := turn.Text
		if turn.Role == "assistant" {
			// Jawaban lama ditulis dalam bentuk perintah, supaya model tidak
			// meniru kalimat biasa.
			content = compact(map[string]string{"op": "say", "text": turn.Text})
		}
		out = append(out, message{Role: turn.Role, Content: content})
	}
	return append(out, message{Role: "user", Content: pageState(in.Sections) + "\n\n## Permintaan\n" + in.Prompt + "\n\n" + reminder})
}

// Reply adalah jawaban model yang sudah mulai mengalir. Selalu ditutup.
type Reply struct {
	body    io.ReadCloser
	cancel  context.CancelFunc
	refs    map[string]bool
	logger  *slog.Logger
	model   string
	started time.Time
}

func (r *Reply) Close() {
	_ = r.body.Close()
	r.cancel()
}

// Design memeriksa izin dan permintaannya, lalu menghubungi model. Galat
// sampai di sini masih bisa dijawab dengan status HTTP biasa; sesudah Reply
// dikembalikan, jawabannya mengalir lewat Stream.
func (s *Service) Design(ctx context.Context, in Request) (*Reply, error) {
	if _, err := authn.Check(ctx, authz.SettingsWebsiteManage); err != nil {
		return nil, err
	}
	refs, err := validate(&in)
	if err != nil {
		return nil, err
	}
	if !s.Configured() {
		return nil, errNotConfigured
	}

	var body bytes.Buffer
	enc := json.NewEncoder(&body)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(map[string]any{
		"model":          s.model,
		"stream":         true,
		"stream_options": map[string]any{"include_usage": true},
		"max_tokens":     maxOutputTokens,
		"messages":       messages(in),
	}); err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(ctx, replyTimeout)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.base.JoinPath("chat/completions").String(), &body)
	if err != nil {
		cancel()
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+s.key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")

	started := time.Now()
	resp, err := s.client.Do(req)
	if err != nil {
		cancel()
		if errors.Is(err, context.Canceled) {
			return nil, err
		}
		s.logger.WarnContext(ctx, "model AI tidak bisa dihubungi", "model", s.model, "error", err)
		return nil, errUnavailable
	}
	if resp.StatusCode != http.StatusOK {
		// Jawaban penyedia hanya masuk log: isinya untuk operator (kunci
		// salah, kredit habis), bukan untuk pengguna.
		detail, _ := io.ReadAll(io.LimitReader(resp.Body, 500))
		_ = resp.Body.Close()
		cancel()
		s.logger.WarnContext(ctx, "model AI menolak permintaan", "model", s.model, "status", resp.StatusCode, "body", string(detail))
		if resp.StatusCode == http.StatusTooManyRequests {
			return nil, errBusy
		}
		return nil, errUnavailable
	}
	return &Reply{body: resp.Body, cancel: cancel, refs: refs, logger: s.logger, model: s.model, started: started}, nil
}

// snippet memotong teks dari model untuk log: cukup untuk melihat bentuknya.
func snippet(text string) string {
	runes := []rune(text)
	if len(runes) <= 400 {
		return text
	}
	return string(runes[:300]) + " … " + string(runes[len(runes)-100:])
}

// chunk adalah satu potongan aliran chat completions.
type chunk struct {
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage *struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
	} `json:"usage"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// Stream membaca jawaban model sampai habis dan memanggil emit untuk setiap
// perintah yang utuh. Galat *apperr.Error boleh ditampilkan ke pengguna;
// perintah yang sudah dikirim sebelum galat tetap berlaku di layar.
func (r *Reply) Stream(ctx context.Context, emit func(Event) error) error {
	var (
		parser         objects
		sent, dropped  int
		finish         string
		promptTokens   int
		completeTokens int
	)
	defer func() {
		r.logger.InfoContext(ctx, "jawaban asisten halaman",
			slog.String("model", r.model),
			slog.Int("events", sent),
			slog.Int("dropped", dropped),
			slog.String("finish", finish),
			slog.Int("prompt_tokens", promptTokens),
			slog.Int("completion_tokens", completeTokens),
			slog.Float64("duration_ms", float64(time.Since(r.started).Microseconds())/1000))
	}()

	lines := bufio.NewScanner(r.body)
	lines.Buffer(make([]byte, 64<<10), 1<<20)
	for lines.Scan() {
		data, ok := strings.CutPrefix(lines.Text(), "data:")
		if !ok {
			continue
		}
		data = strings.TrimSpace(data)
		if data == "[DONE]" {
			break
		}
		var c chunk
		if json.Unmarshal([]byte(data), &c) != nil {
			continue
		}
		if c.Error != nil {
			r.logger.WarnContext(ctx, "model AI berhenti di tengah jawaban", "model", r.model, "error", c.Error.Message)
			return errUnavailable
		}
		if c.Usage != nil {
			promptTokens, completeTokens = c.Usage.PromptTokens, c.Usage.CompletionTokens
		}
		for _, choice := range c.Choices {
			if choice.FinishReason != "" {
				finish = choice.FinishReason
			}
			for _, raw := range parser.feed(choice.Delta.Content) {
				events := translate(raw, r.refs)
				if len(events) == 0 {
					dropped++
					r.logger.WarnContext(ctx, "perintah model AI dilewati", "model", r.model, "command", snippet(string(raw)))
					continue
				}
				for _, event := range events {
					if err := emit(event); err != nil {
						return err
					}
					sent++
				}
			}
		}
	}
	if err := lines.Err(); err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		r.logger.WarnContext(ctx, "aliran jawaban model AI terputus", "model", r.model, "error", err)
		return errUnavailable
	}
	if rest := parser.rest(); rest != "" {
		dropped++
		r.logger.WarnContext(ctx, "perintah model AI tidak utuh", "model", r.model, "finish", finish, "command", snippet(rest))
	}
	if finish == "length" {
		return errTruncated
	}
	if sent == 0 {
		return errEmpty
	}
	if dropped > 0 {
		// Kalimat penutup model biasanya berbunyi "sudah saya kerjakan" walau
		// salah satu perintahnya tidak terbaca; pengguna harus tahu.
		return errPartial
	}
	return nil
}
