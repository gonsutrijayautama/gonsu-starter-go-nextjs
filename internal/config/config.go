// Package config membaca konfigurasi runtime dari environment dan
// memvalidasinya di satu tempat.
//
// Nama variabel ditentukan GONSU dan dipakai apa adanya — jangan menambah nama
// sendiri untuk nilai yang sama. Port sengaja tidak ada di sini: 8080 adalah
// kontrak dengan chart, bukan konfigurasi.
//
// Satu pengecualian: variabel object storage media (MEDIA_S3_*). GONSU belum
// menetapkan namanya, jadi nama di sini SEMENTARA; lihat konstanta envMedia*.
package config

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Config adalah konfigurasi yang sudah divalidasi.
type Config struct {
	// DatabaseURL selalu terisi bila Load berhasil.
	DatabaseURL string

	// Getenv membaca variabel GONSU_* untuk kit web SDK GONSU
	// (web.Options.Getenv). Produk tidak membaca maupun memvalidasi variabel
	// itu sendiri: namanya kontrak GONSU, dan kit yang menilainya saat start.
	// Nil berarti tanpa variabel GONSU sama sekali — bentuk yang dipakai test.
	Getenv func(string) string

	// OIDCRecheck adalah GONSU_OIDC_RECHECK_SECONDS: jeda sebelum sesi GONSU
	// diperiksa ulang. Kit membaca variabel yang sama; produk membutuhkannya
	// untuk memutuskan kapan baris sesi perlu dikunci. Nol berarti bawaan SDK.
	OIDCRecheck time.Duration

	// TrustedProxies adalah daftar alamat/CIDR reverse proxy yang boleh
	// dipercaya menuliskan `X-Forwarded-For`
	// (APP_TRUSTED_PROXIES, dipisah koma). Dipakai memilih alamat client
	// untuk rate limit login, yang belum punya sesi dan karena itu hanya punya
	// alamat sebagai kunci.
	//
	// KOSONG adalah bawaannya, dan kosong berarti header diabaikan seluruhnya
	// — yang dipakai alamat koneksi langsung. Bawaan yang salah arah di sini
	// menghasilkan pembatas yang dapat dilewati dengan satu header, dan
	// pembatas semacam itu LEBIH BURUK daripada tidak ada: ia terlihat seperti
	// perlindungan.
	//
	// Bentuknya DAFTAR ALAMAT, bukan jumlah hop. Jumlah hop mengandaikan
	// panjang rantai tetap; begitu ada CDN di depan proxy, atau satu jalur
	// masuk lewat proxy tambahan dan jalur lain tidak, angka yang benar untuk
	// satu jalur menjadi salah untuk jalur lain — dan salahnya ke arah
	// berbahaya, karena ia lalu menunjuk entri yang ditulis client.
	//
	// Kapan mengisinya:
	//
	//   cloud GONSU   alamat Traefik. Chart memasang NetworkPolicy yang hanya
	//                 mengizinkan Traefik masuk ke pod,
	//                 jadi hop itu tidak dapat dilewati. BELUM DIBUKTIKAN
	//                 bahwa Traefik membuang `X-Forwarded-For` palsu dari
	//                 client; sampai dibuktikan, KOSONG adalah nilai yang
	//                 benar di sana juga;
	//   self-host     kosong sampai administrator menyatakan proxy-nya.
	//                 Pelanggan menjalankan proxy sendiri, GONSU tidak
	//                 memasang maupun mengetahuinya, dan tidak ada jaminan
	//                 jaringan bahwa tidak ada jalan lain ke aplikasi.
	TrustedProxies string

	// MediaStorage adalah object storage untuk isi berkas media. Tidak
	// dikonfigurasi berarti isi berkas disimpan di database.
	MediaStorage MediaStorage
}

// MediaStorage adalah alamat dan kredensial bucket yang berbicara API S3
// (Cloudflare R2, AWS S3, dan sejenisnya).
type MediaStorage struct {
	// Endpoint kosong berarti AWS S3 di Region.
	Endpoint string
	Region   string
	// Bucket kosong berarti object storage tidak dikonfigurasi.
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
	// Prefix adalah awalan key di dalam bucket, kosong atau diakhiri "/".
	// Untuk bucket yang dipakai lebih dari satu aplikasi.
	Prefix string
	// PathStyle: alamat https://host/bucket/key alih-alih
	// https://bucket.host/key.
	PathStyle bool
}

// Configured melaporkan apakah object storage media dikonfigurasi.
func (m MediaStorage) Configured() bool { return m.Bucket != "" }

// Nama variabel object storage media. SEMENTARA: GONSU belum menetapkan nama
// variabel bucket yang diserahkannya ke produk. Begitu ditetapkan, yang
// berubah hanya blok ini dan tabel Environment di README.md.
const (
	envMediaEndpoint  = "MEDIA_S3_ENDPOINT"
	envMediaRegion    = "MEDIA_S3_REGION"
	envMediaBucket    = "MEDIA_S3_BUCKET"
	envMediaAccessKey = "MEDIA_S3_ACCESS_KEY_ID"
	envMediaSecretKey = "MEDIA_S3_SECRET_ACCESS_KEY"
	envMediaPrefix    = "MEDIA_S3_PREFIX"
	envMediaPathStyle = "MEDIA_S3_PATH_STYLE"
)

// Load membaca DATABASE_URL (atau DATABASE_HOST, DATABASE_PORT,
// DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD) dan variabel milik
// produk. Variabel GONSU diteruskan ke kit lewat Getenv.
//
// getenv biasanya os.Getenv; test menyuntikkan map.
func Load(getenv func(string) string) (Config, error) {
	dbURL, err := databaseURL(getenv)
	if err != nil {
		return Config{}, err
	}
	cfg := Config{
		DatabaseURL:    dbURL,
		Getenv:         getenv,
		TrustedProxies: strings.TrimSpace(getenv("APP_TRUSTED_PROXIES")),
	}
	if cfg.OIDCRecheck, err = seconds(getenv, "GONSU_OIDC_RECHECK_SECONDS"); err != nil {
		return Config{}, err
	}
	if cfg.MediaStorage, err = mediaStorage(getenv); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

// mediaStorage membaca MEDIA_S3_*. Semuanya kosong berarti tidak
// dikonfigurasi. Yang terisi sebagian DITOLAK: diam-diam kembali ke database
// membuat berkas tersimpan di tempat yang tidak dimaksud operator.
func mediaStorage(getenv func(string) string) (MediaStorage, error) {
	read := func(key string) string { return strings.TrimSpace(getenv(key)) }
	m := MediaStorage{
		Endpoint:        read(envMediaEndpoint),
		Region:          read(envMediaRegion),
		Bucket:          read(envMediaBucket),
		AccessKeyID:     read(envMediaAccessKey),
		SecretAccessKey: read(envMediaSecretKey),
		Prefix:          read(envMediaPrefix),
	}
	pathStyle := read(envMediaPathStyle)
	if m == (MediaStorage{}) && pathStyle == "" {
		return MediaStorage{}, nil
	}

	var missing []string
	for _, v := range []struct{ key, val string }{
		{envMediaBucket, m.Bucket},
		{envMediaAccessKey, m.AccessKeyID},
		{envMediaSecretKey, m.SecretAccessKey},
	} {
		if v.val == "" {
			missing = append(missing, v.key)
		}
	}
	if len(missing) > 0 {
		return MediaStorage{}, fmt.Errorf("konfigurasi object storage media belum lengkap: %s belum diisi",
			strings.Join(missing, ", "))
	}

	if m.Endpoint != "" {
		u, err := url.Parse(m.Endpoint)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
			return MediaStorage{}, fmt.Errorf("%s %q harus alamat http(s)", envMediaEndpoint, m.Endpoint)
		}
	}
	if m.Region == "" {
		// Layanan selain AWS umumnya tidak mengenal wilayah; R2 memakai "auto".
		// Tanpa endpoint berarti AWS, dan AWS butuh wilayah bucket-nya.
		if m.Endpoint == "" {
			return MediaStorage{}, fmt.Errorf("%s wajib diisi bila %s kosong", envMediaRegion, envMediaEndpoint)
		}
		m.Region = "auto"
	}
	// "/aplikasi" dan "aplikasi/" sama-sama berarti folder "aplikasi/".
	if m.Prefix = strings.Trim(m.Prefix, "/"); m.Prefix != "" {
		m.Prefix += "/"
	}
	if pathStyle != "" {
		v, err := strconv.ParseBool(pathStyle)
		if err != nil {
			return MediaStorage{}, fmt.Errorf("%s %q harus true atau false", envMediaPathStyle, pathStyle)
		}
		m.PathStyle = v
	}
	return m, nil
}

// GonsuLoginConfigured melaporkan apakah GONSU memberi pemasangan ini login:
// issuer di Secret (cloud) atau agent (self-host). Hanya build dev yang
// membutuhkannya, untuk memilih antara GONSU dan login pengembangan di
// /auth/login.
func (c Config) GonsuLoginConfigured() bool {
	if c.Getenv == nil {
		return false
	}
	for _, name := range []string{"GONSU_OIDC_ISSUER", "GONSU_AGENT_URL", "GONSU_LICENSE_URL"} {
		if strings.TrimSpace(c.Getenv(name)) != "" {
			return true
		}
	}
	return false
}

func databaseURL(getenv func(string) string) (string, error) {
	if u := strings.TrimSpace(getenv("DATABASE_URL")); u != "" {
		return u, nil
	}

	host := strings.TrimSpace(getenv("DATABASE_HOST"))
	name := strings.TrimSpace(getenv("DATABASE_NAME"))
	user := strings.TrimSpace(getenv("DATABASE_USER"))
	// Sandi tidak di-trim: spasi di tepinya bisa saja bagian dari sandi.
	password := getenv("DATABASE_PASSWORD")

	if host == "" && name == "" && user == "" {
		return "", errors.New("database belum dikonfigurasi: isi DATABASE_URL, " +
			"atau DATABASE_HOST, DATABASE_NAME, dan DATABASE_USER")
	}

	var missing []string
	for _, v := range []struct{ key, val string }{
		{"DATABASE_HOST", host},
		{"DATABASE_NAME", name},
		{"DATABASE_USER", user},
	} {
		if v.val == "" {
			missing = append(missing, v.key)
		}
	}
	if len(missing) > 0 {
		return "", fmt.Errorf("DATABASE_URL kosong dan konfigurasi database terpisah belum lengkap: %s belum diisi",
			strings.Join(missing, ", "))
	}

	port := strings.TrimSpace(getenv("DATABASE_PORT"))
	if port == "" {
		port = "5432"
	}
	if n, err := strconv.Atoi(port); err != nil || n < 1 || n > 65535 {
		return "", fmt.Errorf("DATABASE_PORT %q bukan nomor port yang valid", port)
	}

	u := url.URL{
		Scheme: "postgres",
		Host:   net.JoinHostPort(host, port),
		Path:   "/" + name,
	}
	if password != "" {
		u.User = url.UserPassword(user, password)
	} else {
		u.User = url.User(user)
	}
	return u.String(), nil
}

func seconds(getenv func(string) string, key string) (time.Duration, error) {
	v := strings.TrimSpace(getenv(key))
	if v == "" {
		return 0, nil
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 1 {
		return 0, fmt.Errorf("%s %q harus bilangan detik positif", key, v)
	}
	return time.Duration(n) * time.Second, nil
}
