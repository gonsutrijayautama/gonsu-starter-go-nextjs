// Package stockmedia mencarikan foto dan video bebas pakai dari Pixabay untuk
// penyusun halaman.
//
// Tiga ketentuan API Pixabay ditegakkan di sini, bukan di layar:
//
//   - setiap jawaban API di-cache 24 jam, jadi permintaan yang sama tidak
//     dikirim ulang ke Pixabay dalam rentang itu;
//   - foto tidak boleh ditautkan ke alamat Pixabay untuk seterusnya (alamatnya
//     pun hanya berlaku 24 jam): berkasnya diunduh lewat PhotoFile dan
//     disimpan bersama halaman. Video boleh ditautkan langsung;
//   - layar yang menampilkan hasilnya menyebut sumbernya (Source);
//   - paling banyak 100 permintaan per menit. Yang dikirim dari sini dibatasi
//     di bawah itu (maxUpstreamPerMinute), dan permintaan yang sama yang
//     datang bersamaan dikirim satu kali saja.
//
// Kunci API hanya dikenal server. Tanpa kunci, pencarian menjawab daftar
// kosong dengan Configured false: fiturnya mati, bukan galat.
package stockmedia

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authn"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authz"
)

// Source adalah nama sumbernya, untuk ditampilkan di samping hasil.
const Source = "Pixabay"

const (
	defaultBaseURL = "https://pixabay.com"
	// cacheTTL adalah ketentuan Pixabay: "Requests must be cached for 24 hours."
	cacheTTL = 24 * time.Hour
	// maxCached membatasi memori: pencarian per bidang usaha sedikit, tapi
	// pencarian per id bisa banyak.
	maxCached = 2000
	// maxPhotoBytes: foto 1280 piksel dari Pixabay jauh di bawah ini.
	maxPhotoBytes = 12 << 20
	photosPerPage = 24
	videosPerPage = 12
	// maxPages: foto per kategori yang bisa ditelusuri. Dengan daftar kategori
	// yang tertutup, ini membatasi banyaknya permintaan berbeda ke Pixabay.
	maxPages = 3
	// maxUpstreamPerMinute: batas Pixabay 100 permintaan per 60 detik. Batas
	// di sini lebih rendah supaya tidak pernah tersentuh, juga bila ada
	// proses lain yang memakai kunci yang sama.
	maxUpstreamPerMinute = 60
)

// categories memetakan kategori (bidang usaha di kuesioner Desain khusus, dan
// kategori umum di pustaka media) ke kata pencarian Pixabay. Daftar tertutup:
// layar tidak bisa mengirim kata pencarian bebas, jadi banyaknya permintaan
// ke Pixabay terbatas.
//
// Kuncinya sama persis dengan `stockCategories` dan `generalCategories` di
// web/lib/stock-media.ts.
var categories = map[string]string{
	// Bawaan pustaka media: campuran semua topik, tanpa kata pencarian.
	Mixed:        "",
	"kuliner":    "restaurant food dish",
	"kafe":       "coffee shop cafe",
	"kecantikan": "beauty salon hair",
	"otomotif":   "car motorcycle repair mechanic",
	"kesehatan":  "clinic doctor healthcare",
	"pendidikan": "classroom students learning",
	"fashion":    "fashion clothing boutique",
	"properti":   "house interior architecture",
	"kebugaran":  "gym fitness workout",
	"wisata":     "travel hotel resort",
	"jasa":       "office business team",
	"toko":       "shop store retail",
	"pertanian":  "farm agriculture harvest",
	"acara":      "wedding event decoration",
	// Kategori umum, hanya di pustaka media.
	"latar":     "abstract background texture",
	"alam":      "nature landscape",
	"orang":     "people smiling portrait",
	"kota":      "city street building",
	"teknologi": "technology computer workspace",
}

// Mixed adalah kategori tanpa topik: pilihan editor Pixabay dari semua topik.
const Mixed = "acak"

// topic melengkapi permintaan dengan kata pencarian kategorinya. Tanpa kata
// (kategori Mixed) Pixabay menjawab dari semua topik; pilihan editornya yang
// diminta, supaya mutunya terjaga.
func topic(values url.Values, query string) url.Values {
	if query == "" {
		values.Set("editors_choice", "true")
		return values
	}
	values.Set("q", query)
	return values
}

// Photo adalah satu foto hasil pencarian. Berkasnya diambil lewat PhotoFile.
type Photo struct {
	ID     int64  `json:"id"`
	Tags   string `json:"tags"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
	// PreviewURL: gambar kecil untuk daftar hasil. Hanya berlaku 24 jam.
	PreviewURL string `json:"preview_url"`
	// ThumbnailURL: gambar sedang untuk kisi pustaka media. Hanya berlaku 24 jam.
	ThumbnailURL string `json:"thumbnail_url"`
	PageURL      string `json:"page_url"`
	User         string `json:"user"`
}

// Video adalah satu video hasil pencarian. URL boleh ditautkan langsung.
type Video struct {
	ID           int64  `json:"id"`
	Tags         string `json:"tags"`
	Width        int    `json:"width"`
	Height       int    `json:"height"`
	Duration     int    `json:"duration"`
	URL          string `json:"url"`
	ThumbnailURL string `json:"thumbnail_url"`
	PageURL      string `json:"page_url"`
	User         string `json:"user"`
}

// Result adalah satu halaman foto untuk satu kategori. Video hanya ada di
// halaman pertama.
type Result struct {
	Photos []Photo `json:"photos"`
	Videos []Video `json:"videos"`
	Page   int     `json:"page"`
	// HasMore: masih ada halaman foto berikutnya yang boleh diminta.
	HasMore bool `json:"has_more"`
}

// Options: BaseURL dan HTTPClient hanya diisi test.
type Options struct {
	APIKey     string
	BaseURL    string
	HTTPClient *http.Client
	Logger     *slog.Logger
	Now        func() time.Time
}

// Service menjawab pencarian dari cache, atau dari Pixabay bila belum ada.
type Service struct {
	key    string
	base   *url.URL
	client *http.Client
	logger *slog.Logger
	now    func() time.Time

	mu    sync.Mutex
	cache map[string]cached
	// files: alamat berkas foto dari hasil pencarian yang masih di-cache, supaya
	// mengunduh foto yang baru saja dicari tidak perlu bertanya lagi ke Pixabay.
	files map[int64]fileRef
	// flights: permintaan yang sedang berjalan, per kunci cache.
	flights map[string]*flight
	// sent: waktu permintaan yang dikirim ke Pixabay dalam semenit terakhir.
	sent []time.Time
}

// fileRef: alamat berkas foto berlaku selama jawaban yang memuatnya, 24 jam.
type fileRef struct {
	address string
	expires time.Time
}

// flight adalah satu permintaan ke Pixabay yang sedang berjalan; permintaan
// lain untuk kunci yang sama menunggu hasilnya alih-alih ikut mengirim.
type flight struct {
	done    chan struct{}
	body    []byte
	expires time.Time
	err     error
}

type cached struct {
	body    []byte
	expires time.Time
}

func NewService(o Options) (*Service, error) {
	base := o.BaseURL
	if base == "" {
		base = defaultBaseURL
	}
	u, err := url.Parse(base)
	if err != nil || u.Host == "" {
		return nil, fmt.Errorf("alamat API Pixabay %q tidak sah", base)
	}
	s := &Service{key: strings.TrimSpace(o.APIKey), base: u, client: o.HTTPClient, logger: o.Logger, now: o.Now, cache: map[string]cached{}, files: map[int64]fileRef{}, flights: map[string]*flight{}}
	if s.client == nil {
		s.client = &http.Client{Timeout: 20 * time.Second}
	}
	if s.logger == nil {
		s.logger = slog.Default()
	}
	if s.now == nil {
		s.now = time.Now
	}
	return s, nil
}

// Configured melaporkan apakah kunci API diisi.
func (s *Service) Configured() bool { return s.key != "" }

var errUnavailable = apperr.StockMediaUnavailable("Pixabay sedang tidak bisa dihubungi. Coba lagi sebentar lagi.")

// Search mengembalikan satu halaman foto untuk satu kategori, dan di halaman
// pertama juga videonya. page di luar 1..maxPages dianggap halaman pertama.
func (s *Service) Search(ctx context.Context, category string, page int) (Result, error) {
	if _, err := authn.Check(ctx, authz.SettingsWebsiteManage); err != nil {
		return Result{}, err
	}
	query, ok := categories[category]
	if !ok {
		return Result{}, apperr.Validation("Kategori tidak dikenal.",
			apperr.FieldError{Field: "category", Message: "Pilih salah satu kategori yang tersedia."})
	}
	if page < 1 || page > maxPages {
		page = 1
	}
	out := Result{Photos: []Photo{}, Videos: []Video{}, Page: page}
	if !s.Configured() {
		return out, nil
	}
	photos, total, err := s.photos(ctx, topic(url.Values{
		"image_type": {"photo"}, "safesearch": {"true"},
		"per_page": {strconv.Itoa(photosPerPage)}, "page": {strconv.Itoa(page)},
	}, query))
	if err != nil {
		return Result{}, err
	}
	out.Photos = photos
	out.HasMore = page < maxPages && total > page*photosPerPage
	if page == 1 {
		videos, err := s.videos(ctx, topic(url.Values{"safesearch": {"true"}, "per_page": {strconv.Itoa(videosPerPage)}}, query))
		if err != nil {
			return Result{}, err
		}
		out.Videos = videos
	}
	return out, nil
}

// Video mengembalikan satu video menurut id-nya.
func (s *Service) Video(ctx context.Context, id int64) (Video, error) {
	if _, err := authn.Check(ctx, authz.SettingsWebsiteManage); err != nil {
		return Video{}, err
	}
	if !s.Configured() {
		return Video{}, errNotFound
	}
	videos, err := s.videos(ctx, url.Values{"id": {strconv.FormatInt(id, 10)}})
	if err != nil {
		return Video{}, err
	}
	if len(videos) == 0 {
		return Video{}, errNotFound
	}
	return videos[0], nil
}

var errNotFound = apperr.NotFound("Foto atau video itu tidak ditemukan di Pixabay.")

// File adalah isi satu foto. Pemanggil wajib menutup Body.
type File struct {
	Body        io.ReadCloser
	ContentType string
}

// PhotoFile mengunduh satu foto menurut id-nya, untuk disimpan bersama
// halaman. Alamatnya diambil dari jawaban API, tidak pernah dari pemanggil:
// server ini tidak bisa disuruh mengunduh alamat sembarang.
func (s *Service) PhotoFile(ctx context.Context, id int64) (File, error) {
	if _, err := authn.Check(ctx, authz.SettingsWebsiteManage); err != nil {
		return File{}, err
	}
	if !s.Configured() {
		return File{}, errNotFound
	}
	address := s.fileAddress(id)
	if address == "" {
		// Foto yang tidak ada di hasil pencarian yang masih di-cache (misalnya
		// desain yang diimpor keesokan harinya): ditanyakan menurut id-nya.
		if _, _, err := s.photos(ctx, url.Values{"id": {strconv.FormatInt(id, 10)}}); err != nil {
			return File{}, err
		}
		if address = s.fileAddress(id); address == "" {
			return File{}, errNotFound
		}
	}
	target, err := url.Parse(address)
	if err != nil || !s.trusted(target) {
		s.logger.WarnContext(ctx, "alamat foto Pixabay ditolak", "id", id, "host", hostOf(target))
		return File{}, errUnavailable
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), nil)
	if err != nil {
		return File{}, err
	}
	resp, err := s.client.Do(req)
	if err != nil {
		s.logger.WarnContext(ctx, "unduh foto Pixabay gagal", "id", id, "error", err)
		return File{}, errUnavailable
	}
	kind := resp.Header.Get("Content-Type")
	if resp.StatusCode != http.StatusOK || !strings.HasPrefix(kind, "image/") {
		resp.Body.Close()
		s.logger.WarnContext(ctx, "unduh foto Pixabay ditolak", "id", id, "status", resp.StatusCode, "content_type", kind)
		return File{}, errUnavailable
	}
	return File{Body: limitedBody{io.LimitReader(resp.Body, maxPhotoBytes), resp.Body}, ContentType: kind}, nil
}

// limitedBody membaca paling banyak maxPhotoBytes, dan menutup jawaban aslinya.
type limitedBody struct {
	io.Reader
	io.Closer
}

// trusted: berkas hanya diunduh dari Pixabay (atau dari alamat API yang
// dipasang test), lewat https.
func (s *Service) trusted(u *url.URL) bool {
	if u == nil {
		return false
	}
	// Host beserta port: alamat API yang dipasang test tidak ikut memercayai port lain di mesin yang sama.
	if u.Host == s.base.Host && u.Scheme == s.base.Scheme {
		return true
	}
	host := u.Hostname()
	return u.Scheme == "https" && (host == "pixabay.com" || strings.HasSuffix(host, ".pixabay.com"))
}

func hostOf(u *url.URL) string {
	if u == nil {
		return ""
	}
	return u.Hostname()
}

func (s *Service) photos(ctx context.Context, query url.Values) ([]Photo, int, error) {
	var page struct {
		TotalHits int `json:"totalHits"`
		Hits      []struct {
			ID            int64  `json:"id"`
			Tags          string `json:"tags"`
			ImageWidth    int    `json:"imageWidth"`
			ImageHeight   int    `json:"imageHeight"`
			PreviewURL    string `json:"previewURL"`
			WebformatURL  string `json:"webformatURL"`
			LargeImageURL string `json:"largeImageURL"`
			PageURL       string `json:"pageURL"`
			User          string `json:"user"`
		} `json:"hits"`
	}
	expires, err := s.get(ctx, "/api/", query, &page)
	if err != nil {
		return nil, 0, err
	}
	out := make([]Photo, 0, len(page.Hits))
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, hit := range page.Hits {
		// Pixabay menyediakan ukuran lain dengan mengganti "_640" di alamat ini; 340 cukup untuk kisi pilihan.
		thumbnail := strings.Replace(hit.WebformatURL, "_640.", "_340.", 1)
		if thumbnail == "" {
			thumbnail = hit.PreviewURL
		}
		out = append(out, Photo{ID: hit.ID, Tags: hit.Tags, Width: hit.ImageWidth, Height: hit.ImageHeight,
			PreviewURL: hit.PreviewURL, ThumbnailURL: thumbnail, PageURL: hit.PageURL, User: hit.User})
		file := hit.LargeImageURL
		if file == "" {
			file = hit.WebformatURL
		}
		if _, known := s.files[hit.ID]; file != "" && (known || len(s.files) < maxCached) {
			s.files[hit.ID] = fileRef{address: file, expires: expires}
		}
	}
	return out, page.TotalHits, nil
}

// fileAddress adalah alamat berkas satu foto dari hasil pencarian terakhir, atau "" bila tidak dikenal.
func (s *Service) fileAddress(id int64) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	ref, ok := s.files[id]
	if !ok {
		return ""
	}
	if !s.now().Before(ref.expires) {
		delete(s.files, id)
		return ""
	}
	return ref.address
}

func (s *Service) videos(ctx context.Context, query url.Values) ([]Video, error) {
	type rendition struct {
		URL       string `json:"url"`
		Width     int    `json:"width"`
		Height    int    `json:"height"`
		Thumbnail string `json:"thumbnail"`
	}
	var page struct {
		Hits []struct {
			ID       int64  `json:"id"`
			Tags     string `json:"tags"`
			Duration int    `json:"duration"`
			PageURL  string `json:"pageURL"`
			User     string `json:"user"`
			Videos   struct {
				Medium rendition `json:"medium"`
				Small  rendition `json:"small"`
				Tiny   rendition `json:"tiny"`
			} `json:"videos"`
		} `json:"hits"`
	}
	if _, err := s.get(ctx, "/api/videos/", query, &page); err != nil {
		return nil, err
	}
	out := make([]Video, 0, len(page.Hits))
	for _, hit := range page.Hits {
		// Ukuran sedang cukup untuk latar bagian; yang lebih besar memberatkan halaman.
		pick := hit.Videos.Medium
		for _, candidate := range []rendition{hit.Videos.Small, hit.Videos.Tiny} {
			if pick.URL == "" {
				pick = candidate
			}
		}
		if pick.URL == "" {
			continue
		}
		out = append(out, Video{ID: hit.ID, Tags: hit.Tags, Width: pick.Width, Height: pick.Height, Duration: hit.Duration,
			URL: pick.URL, ThumbnailURL: pick.Thumbnail, PageURL: hit.PageURL, User: hit.User})
	}
	return out, nil
}

// get menjawab dari cache selama belum 24 jam; sesudahnya bertanya ke Pixabay
// dan menyimpan jawabannya. Kunci cache tidak memuat kunci API. Permintaan
// yang sama yang datang bersamaan menunggu satu jawaban yang sama. Yang
// dikembalikan adalah saat jawaban itu kedaluwarsa.
func (s *Service) get(ctx context.Context, path string, query url.Values, into any) (time.Time, error) {
	cacheKey := path + "?" + query.Encode()

	s.mu.Lock()
	if entry, ok := s.cache[cacheKey]; ok && s.now().Before(entry.expires) {
		s.mu.Unlock()
		return entry.expires, json.Unmarshal(entry.body, into)
	}
	if running, ok := s.flights[cacheKey]; ok {
		s.mu.Unlock()
		select {
		case <-running.done:
		case <-ctx.Done():
			return time.Time{}, ctx.Err()
		}
		if running.err != nil {
			return time.Time{}, running.err
		}
		return running.expires, json.Unmarshal(running.body, into)
	}
	if !s.allowLocked() {
		s.mu.Unlock()
		s.logger.WarnContext(ctx, "permintaan ke Pixabay ditahan: batas per menit tercapai", "path", path)
		return time.Time{}, apperr.RateLimited("Terlalu banyak pencarian foto dalam satu menit. Coba lagi sebentar lagi.", time.Minute)
	}
	mine := &flight{done: make(chan struct{})}
	s.flights[cacheKey] = mine
	s.mu.Unlock()

	mine.body, mine.err = s.fetch(ctx, path, query)

	s.mu.Lock()
	delete(s.flights, cacheKey)
	if mine.err == nil {
		mine.expires = s.now().Add(cacheTTL)
		s.storeLocked(cacheKey, mine.body, mine.expires)
	}
	s.mu.Unlock()
	close(mine.done)

	if mine.err != nil {
		return time.Time{}, mine.err
	}
	return mine.expires, json.Unmarshal(mine.body, into)
}

// allowLocked mencatat satu permintaan keluar, atau menolak bila semenit
// terakhir sudah penuh. Dipanggil dengan s.mu terkunci.
func (s *Service) allowLocked() bool {
	now := s.now()
	recent := s.sent[:0]
	for _, at := range s.sent {
		if now.Sub(at) < time.Minute {
			recent = append(recent, at)
		}
	}
	s.sent = recent
	if len(s.sent) >= maxUpstreamPerMinute {
		return false
	}
	s.sent = append(s.sent, now)
	return true
}

// fetch mengirim satu permintaan ke Pixabay dan mengembalikan isi jawabannya yang sudah dipastikan JSON.
func (s *Service) fetch(ctx context.Context, path string, query url.Values) ([]byte, error) {
	full := url.Values{"key": {s.key}}
	for k, v := range query {
		full[k] = v
	}
	target := *s.base
	target.Path = path
	target.RawQuery = full.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), nil)
	if err != nil {
		return nil, err
	}
	resp, err := s.client.Do(req)
	if err != nil {
		// Galat klien HTTP memuat alamat lengkap beserta kunci API: yang dicatat hanya jenisnya.
		var urlErr *url.Error
		reason := "galat jaringan"
		if errors.As(err, &urlErr) && urlErr.Timeout() {
			reason = "waktu tunggu habis"
		}
		s.logger.WarnContext(ctx, "Pixabay tidak menjawab", "path", path, "reason", reason)
		return nil, errUnavailable
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, errUnavailable
	}
	if resp.StatusCode != http.StatusOK {
		s.logger.WarnContext(ctx, "Pixabay menolak permintaan", "path", path, "status", resp.StatusCode)
		return nil, errUnavailable
	}
	if !json.Valid(body) {
		s.logger.WarnContext(ctx, "jawaban Pixabay tidak terbaca", "path", path)
		return nil, errUnavailable
	}
	return body, nil
}

// storeLocked menyimpan satu jawaban sampai expires. Dipanggil dengan s.mu terkunci.
func (s *Service) storeLocked(key string, body []byte, expires time.Time) {
	if len(s.cache) >= maxCached {
		now := s.now()
		for k, entry := range s.cache {
			if !now.Before(entry.expires) {
				delete(s.cache, k)
			}
		}
		// Masih penuh sesudah yang kedaluwarsa dibuang: jawaban ini tidak
		// disimpan. Lebih baik bertanya ulang daripada memori tumbuh terus.
		if len(s.cache) >= maxCached {
			return
		}
	}
	s.cache[key] = cached{body: body, expires: expires}
}
