// Package config membaca konfigurasi runtime dari environment dan
// memvalidasinya di satu tempat.
//
// Nama variabel ditentukan GONSU dan dipakai apa adanya — jangan menambah nama
// sendiri untuk nilai yang sama. Port sengaja tidak ada di sini: 8080 adalah
// kontrak dengan chart, bukan konfigurasi.
//
// Yang berawalan APP_ adalah milik produk: GONSU tidak mengisinya.
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

	// ObjectStorage adalah bucket penyimpanan berkas pemasangan ini. Tidak
	// dikonfigurasi berarti isi berkas disimpan di database.
	ObjectStorage ObjectStorage
}

// ObjectStorage adalah alamat dan kredensial bucket yang berbicara API S3
// (Cloudflare R2, AWS S3, dan sejenisnya). Satu bucket hanya dipakai satu
// pemasangan.
type ObjectStorage struct {
	Endpoint string
	Region   string
	// Bucket kosong berarti penyimpanan objek tidak dikonfigurasi.
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
	// PathStyle: alamat https://host/bucket/key alih-alih
	// https://bucket.host/key.
	PathStyle bool
}

// Configured melaporkan apakah penyimpanan objek dikonfigurasi.
func (o ObjectStorage) Configured() bool { return o.Bucket != "" }

// storageKeys adalah lima kunci STORAGE_* — kontrak GONSU, sama seperti
// DATABASE_*: kelimanya ada, atau tidak satu pun. Di cloud GONSU yang
// mengisinya; di self-host pelanggan boleh mengisinya dengan penyimpanan S3
// miliknya.
var storageKeys = [...]string{
	"STORAGE_ENDPOINT",
	"STORAGE_REGION",
	"STORAGE_BUCKET",
	"STORAGE_ACCESS_KEY_ID",
	"STORAGE_SECRET_ACCESS_KEY",
}

// envStoragePathStyle milik produk, bukan kontrak GONSU: untuk layanan S3
// beralamat https://host/bucket/key, yang umum pada penyimpanan milik sendiri.
const envStoragePathStyle = "APP_STORAGE_PATH_STYLE"

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
	if cfg.ObjectStorage, err = objectStorage(getenv); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

// objectStorage membaca STORAGE_*. Tidak satu pun terisi berarti tidak
// dikonfigurasi. Yang terisi sebagian DITOLAK: diam-diam kembali ke database
// membuat berkas tersimpan di tempat yang tidak dimaksud.
func objectStorage(getenv func(string) string) (ObjectStorage, error) {
	values := make(map[string]string, len(storageKeys))
	var missing []string
	for _, key := range storageKeys {
		// Kredensial ikut di-trim: nilainya dari berkas secret, yang sering
		// berakhir baris baru, dan kunci S3 tidak memuat spasi.
		if values[key] = strings.TrimSpace(getenv(key)); values[key] == "" {
			missing = append(missing, key)
		}
	}
	pathStyle := strings.TrimSpace(getenv(envStoragePathStyle))
	if len(missing) == len(storageKeys) && pathStyle == "" {
		return ObjectStorage{}, nil
	}
	if len(missing) > 0 {
		return ObjectStorage{}, fmt.Errorf("konfigurasi penyimpanan objek belum lengkap: %s belum diisi",
			strings.Join(missing, ", "))
	}

	o := ObjectStorage{
		Endpoint:        values["STORAGE_ENDPOINT"],
		Region:          values["STORAGE_REGION"],
		Bucket:          values["STORAGE_BUCKET"],
		AccessKeyID:     values["STORAGE_ACCESS_KEY_ID"],
		SecretAccessKey: values["STORAGE_SECRET_ACCESS_KEY"],
	}
	u, err := url.Parse(o.Endpoint)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return ObjectStorage{}, fmt.Errorf("STORAGE_ENDPOINT %q harus alamat http(s)", o.Endpoint)
	}
	if pathStyle != "" {
		v, err := strconv.ParseBool(pathStyle)
		if err != nil {
			return ObjectStorage{}, fmt.Errorf("%s %q harus true atau false", envStoragePathStyle, pathStyle)
		}
		o.PathStyle = v
	}
	return o, nil
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
