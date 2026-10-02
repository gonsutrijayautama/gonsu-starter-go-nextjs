# Font disimpan di sini, tidak diunduh saat build

`next/font/google` mengunduh berkas font dari `fonts.gstatic.com` setiap kali
build berjalan, sehingga build bergantung pada jaringan ke pihak ketiga. Dari
sebagian jaringan alamat itu tidak terjangkau, dan galatnya menyesatkan
(`Module not found` untuk modul font internal Next), bukan galat jaringan.

Berkas di sini persis yang diunduh `next/font/google` untuk subset `latin`.
Keduanya variable font, `font-weight: 100 900`:

    sha256  3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62  inter-latin-variable.woff2
    sha256  684ad5b531f81d43c1e8c7038262d5db7cdc1f68006e04d6c7769efa8d33c8cc  geist-mono-latin-variable.woff2

Keduanya berlisensi SIL Open Font License 1.1. Teks lisensinya ada di sebelah
berkasnya dan harus ikut bila berkas font dipindahkan.

Mengganti font: ganti berkasnya, perbarui sha256 di atas, dan sesuaikan
`localFont(...)` di `app/layout.tsx`.
