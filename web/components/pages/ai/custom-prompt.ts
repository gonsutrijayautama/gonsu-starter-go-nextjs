import type { Site } from "@/lib/site"
import { mixedCategory, stockCategories, type StockCategory, type StockPhoto, type StockVideo } from "@/lib/stock-media"

import { styleGuides, type DesignStyle } from "./prompt"

// Prompt "Desain khusus": AI merancang setiap bagian sendiri dengan HTML dan
// CSS, tanpa katalog blok. Jawabannya diimpor lewat custom-import.ts menjadi
// blok "Bagian khusus". Dipakai dengan ChatGPT atau Claude milik pengguna,
// karena rancangan seperti ini hanya layak dari model besar.

export type Mood = "light" | "dark" | "brand"

export type CustomBrief = {
  /** Bidang usaha: menentukan foto dan video yang ditawarkan ke AI. Kosong: belum dipilih. */
  category: StockCategory | typeof mixedCategory | ""
  page: string
  look: DesignStyle
  mood: Mood
  /** Warna merek: kode warna atau namanya ("#ea580c", "hijau tua"). Boleh kosong. */
  color: string
  /** Bagian yang wajib ada; kosong berarti AI yang memilih. */
  sections: string[]
  tone: string
  offer: string
  notes: string
}

/** Pilihan terakhir di kuesioner, untuk usaha di luar daftar: foto dan videonya campuran semua topik. */
export const otherCategory = { value: mixedCategory, label: "Bidang lain" } as const

export const customPages = ["Beranda (halaman utama)", "Layanan", "Daftar harga", "Tentang kami", "Promo", "Kontak dan lokasi", "Portofolio hasil kerja"]

export const customLooks = (Object.entries(styleGuides) as [DesignStyle, (typeof styleGuides)[DesignStyle]][]).map(([value, guide]) => ({
  value,
  label: guide.label,
  hint: guide.hint,
}))

export const customMoods: { value: Mood; label: string; hint: string; rule: string }[] = [
  {
    value: "light",
    label: "Terang dan lapang",
    hint: "Latar terang, banyak ruang kosong",
    rule: "Terang dan lapang: latar dari var(--background) dan var(--card), tulisan dari var(--foreground).",
  },
  {
    value: "dark",
    label: "Gelap dan dramatis",
    hint: "Latar gelap, tulisan terang",
    rule: "Gelap dan dramatis: tulis sendiri warna latar gelap dan tulisan terangnya di setiap bagian; jangan mengandalkan var(--background).",
  },
  {
    value: "brand",
    label: "Berwarna",
    hint: "Warna merek dipakai berani di beberapa bagian",
    rule: "Berwarna: pakai warna merek dengan berani di dua atau tiga bagian, selang-seling dengan bagian berlatar terang.",
  },
]

export const customSections = [
  "Pembuka dengan foto besar",
  "Keunggulan",
  "Daftar produk atau layanan dengan harga",
  "Cerita usaha",
  "Testimoni pelanggan",
  "Galeri foto",
  "Cara pesan",
  "Tanya jawab",
  "Promo",
  "Ajakan menghubungi",
]

export const customTones = ["Santai dan ramah", "Profesional dan terpercaya", "Ceria dan penuh semangat", "Mewah dan elegan"]

/** Awalan id foto dan video Pixabay di atribut data-photo dan data-video ("pixabay:12345"). */
export const stockPrefix = "pixabay:"

/** Yang ditawarkan ke AI dibatasi supaya prompt tetap pendek. */
const maxPhotos = 16
const maxVideos = 4

/** Tag Pixabay bisa belasan kata: beberapa yang pertama sudah cukup untuk memilih. */
const briefTags = (tags: string) => tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 6).join(", ")

const shapeOf = (width: number, height: number) => (width > height * 1.15 ? "mendatar" : height > width * 1.15 ? "tegak" : "persegi")

/** Daftar foto dan video Pixabay untuk dipilih AI. Kosong bila tidak ada yang tersedia. */
function mediaLines(media: { photos: StockPhoto[]; videos: StockVideo[] }): string[] {
  const photos = media.photos.slice(0, maxPhotos)
  const videos = media.videos.slice(0, maxVideos)
  if (photos.length === 0 && videos.length === 0) return []
  return [
    "",
    "## Foto dan video yang tersedia",
    "Dari Pixabay. Pilih yang cocok dengan isi bagiannya; jangan memakai gambar atau video dari tempat lain, dan jangan memakai satu foto dua kali.",
    ...(photos.length > 0
      ? [
          `Foto, dipakai dengan <div class="photo" data-photo="${stockPrefix}ID"></div>:`,
          ...photos.map((photo) => `- ${stockPrefix}${photo.id}: ${shapeOf(photo.width, photo.height)}, ${briefTags(photo.tags)}`),
        ]
      : []),
    ...(videos.length > 0
      ? [
          `Video tanpa suara yang berulang, paling banyak satu di halaman (cocok untuk latar bagian pembuka), dipakai dengan <div class="video" data-video="${stockPrefix}ID"></div>:`,
          ...videos.map((video) => `- ${stockPrefix}${video.id}: ${video.duration} detik, ${briefTags(video.tags)}`),
        ]
      : []),
    'Bila tidak ada yang cocok untuk satu tempat, pakai <div class="photo" data-photo="keterangan singkat fotonya"></div>: pemilik usaha mengunggah fotonya sendiri.',
  ]
}

export function buildCustomPrompt(brief: CustomBrief, site: Site, media: { photos: StockPhoto[]; videos: StockVideo[] } = { photos: [], videos: [] }): string {
  const category = stockCategories.find((item) => item.value === brief.category)?.label
  const services = site.services.map((service) => [service.title, service.description].filter(Boolean).join(": ")).filter(Boolean)
  const look = styleGuides[brief.look]
  const mood = customMoods.find((item) => item.value === brief.mood) ?? customMoods[0]!
  // null: baris yang tidak berlaku dibuang; "" adalah jeda antarbagian.
  const lines: (string | null)[] = [
    "Kamu desainer web dan penulis iklan berpengalaman untuk usaha kecil di Indonesia.",
    "Rancang satu halaman web yang menarik dan meyakinkan untuk usaha ini. Kamu merancang setiap bagian sendiri dengan HTML dan CSS: tidak ada templat, jadi bentuk dan tata letaknya bebas. Buat desain yang khas untuk usaha ini.",
    "",
    "## Hasil yang diminta",
    'Buat berkas bernama halaman.html yang bisa diunduh, berisi satu <style> di awal, lalu 6–9 <section data-name="Nama bagian">.',
    "Bila kamu tidak bisa membuat berkas, tulis isinya utuh dalam SATU blok kode ```html.",
    "Tanpa <html>, <head>, <body>, navbar, dan kaki situs: situsnya sudah punya navbar dan kaki situs sendiri.",
    'Jangan menulis penjelasan panjang. Bila jawabanmu terpotong, lanjutkan tepat dari karakter terakhir dalam blok kode baru saat diminta "lanjutkan".',
    "",
    "## Tentang usaha",
    `- Nama usaha: ${site.name || "(belum diisi)"}`,
    category || site.industry ? `- Bidang: ${[category, site.industry].filter(Boolean).join("; ")}` : null,
    site.contact.city ? `- Kota: ${site.contact.city}` : null,
    `- Produk/layanan: ${brief.offer || "(belum diisi)"}`,
    services.length > 0 ? `- Layanan di profil: ${services.join("; ")}` : null,
    site.summary ? `- Ringkasan usaha: ${site.summary}` : null,
    site.about.text ? `- Cerita usaha: ${site.about.text}` : null,
    site.tagline ? `- Slogan: ${site.tagline}` : null,
    "",
    "## Permintaan",
    `- Jenis halaman: ${brief.page}`,
    `- Gaya desain: ${look.label} (${look.hint.toLowerCase()})`,
    `- Suasana warna: ${mood.rule}`,
    brief.color ? `- Warna merek: ${brief.color}. Turunkan warna yang lebih pucat dan lebih tua darinya.` : "- Warna merek: pakai var(--primary).",
    brief.sections.length > 0 ? `- Bagian yang wajib ada: ${brief.sections.join(", ")}. Tambah bagian lain yang membuat halaman lengkap.` : null,
    `- Gaya bahasa: ${brief.tone}`,
    brief.notes ? `- Catatan dari pemilik usaha: ${brief.notes}` : null,
    "",
    "## Aturan teknis",
    "1. Hanya HTML dan CSS. Tanpa <script>, tanpa atribut on…, tanpa <iframe>, tanpa formulir, tanpa @import, tanpa url() ke internet, tanpa font dari luar (font sudah diatur: pakai font-family: inherit).",
    "2. Beri setiap bagian kelasnya sendiri dan awali setiap aturan CSS dengan kelas itu (misalnya .hero …, .layanan …). Jangan menata body, html, atau elemen tanpa kelas.",
    "3. Variabel tema yang tersedia: var(--background), var(--foreground), var(--card), var(--muted), var(--muted-foreground), var(--border), var(--primary), var(--primary-foreground), dan sudut var(--radius). Jangan mendefinisikan ulang variabel itu.",
    "4. Responsif: tulis untuk ponsel dulu, lalu @media (min-width: 768px) untuk layar lebar. Lebar isi paling banyak 1100px, di tengah, dengan jarak tepi di ponsel.",
    '5. Foto dan video: jangan <img> dan jangan <video>. Pakai <div class="photo" data-photo="…"></div> (dan <div class="video" data-video="…"></div> bila ada video yang tersedia), lalu atur ukurannya lewat CSS. Elemen itu dibiarkan kosong: jangan menaruh teks di dalamnya dan jangan menumpuk teks di atasnya.',
    media.photos.length === 0 ? '   Isi data-photo adalah keterangan singkat fotonya; pemilik usaha mengunggah fotonya sendiri.' : null,
    '6. Ikon: SVG inline sederhana dengan stroke="currentColor". Animasi hanya CSS dan secukupnya.',
    '7. Tautan dan tombol berupa <a href="#kontak"> atau jangkar ke id bagian lain di halaman ini.',
    "",
    "## Aturan isi",
    "1. Bahasa Indonesia sesuai gaya bahasa di atas. Isi spesifik untuk usaha ini: sebut produk, keunggulan, dan nama kota bila wajar.",
    "2. Judul paling banyak 8 kata; kalimat di bawah judul paling banyak 25 kata; tombol berupa kata kerja (Hubungi kami, Lihat layanan).",
    "3. Jangan mengarang harga, alamat, nomor telepon, atau jam buka yang tidak ada di data di atas.",
    "4. Testimoni, rating, dan angka capaian yang tidak ada di data di atas hanya boleh sebagai contoh yang ditandai jelas, misalnya “(contoh, ganti dengan testimoni asli)”.",
    ...mediaLines(media),
  ]
  return lines.filter((line): line is string => line !== null).join("\n")
}
