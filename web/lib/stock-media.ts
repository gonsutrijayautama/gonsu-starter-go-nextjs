import { api } from "@/lib/api"

// Foto dan video bebas pakai dari Pixabay, lewat server (/v1/stock-media).
// Kunci API-nya hanya ada di server, dan server yang menjaga ketentuan
// Pixabay: jawaban di-cache 24 jam, dan foto diunduh — tidak ditautkan ke
// alamat Pixabay — sebelum dipakai di halaman.

/** Satu foto hasil pencarian, seperti dijawab /v1/stock-media. */
export type StockPhoto = {
  id: number
  tags: string
  width: number
  height: number
  /** Gambar kecil untuk daftar hasil. Hanya berlaku 24 jam: jangan disimpan. */
  preview_url: string
  /** Gambar sedang untuk kisi pustaka media. Hanya berlaku 24 jam: jangan disimpan. */
  thumbnail_url: string
  page_url: string
  user: string
}

export type StockVideo = {
  id: number
  tags: string
  width: number
  height: number
  duration: number
  /** Boleh ditautkan langsung dari halaman. */
  url: string
  thumbnail_url: string
  page_url: string
  user: string
}

export type StockMedia = {
  /** Satu halaman foto untuk satu kategori; video hanya ada di halaman pertama. */
  data: { photos: StockPhoto[]; videos: StockVideo[]; page: number; has_more: boolean }
  /** false: kunci API Pixabay belum diisi di server, jadi daftarnya selalu kosong. */
  configured: boolean
  /** Nama sumbernya, untuk ditampilkan di samping hasil ("Pixabay"). */
  source: string
}

export const stockMediaPath = "/v1/stock-media"

/** Bidang usaha, untuk kuesioner Desain khusus, urut abjad. `value` sama persis dengan kunci `categories` di internal/stockmedia. */
export const stockCategories = [
  { value: "acara", label: "Acara dan pernikahan" },
  { value: "fashion", label: "Fashion dan pakaian" },
  { value: "jasa", label: "Jasa profesional" },
  { value: "kafe", label: "Kafe dan kedai kopi" },
  { value: "kebugaran", label: "Kebugaran dan olahraga" },
  { value: "kecantikan", label: "Kecantikan dan salon" },
  { value: "kesehatan", label: "Kesehatan dan klinik" },
  { value: "kuliner", label: "Kuliner dan rumah makan" },
  { value: "otomotif", label: "Otomotif dan bengkel" },
  { value: "pendidikan", label: "Pendidikan dan kursus" },
  { value: "pertanian", label: "Pertanian dan hasil bumi" },
  { value: "properti", label: "Properti dan interior" },
  { value: "toko", label: "Toko dan ritel" },
  { value: "wisata", label: "Wisata dan penginapan" },
] as const

export type StockCategory = (typeof stockCategories)[number]["value"]

/** Campuran semua topik, tanpa kata pencarian: bawaan pustaka media. Sama dengan `Mixed` di internal/stockmedia. */
export const mixedCategory = "acak"

/** Kategori umum, hanya di pustaka media. `value` juga kunci `categories` di internal/stockmedia. */
export const generalCategories = [
  { value: mixedCategory, label: "Acak (semua topik)" },
  { value: "alam", label: "Alam dan pemandangan" },
  { value: "kota", label: "Kota dan bangunan" },
  { value: "latar", label: "Latar dan tekstur" },
  { value: "orang", label: "Orang dan tim" },
  { value: "teknologi", label: "Teknologi dan ruang kerja" },
] as const

export type LibraryCategory = StockCategory | (typeof generalCategories)[number]["value"]

/** Banyaknya halaman foto per kategori; sama dengan `maxPages` di internal/stockmedia. */
export const stockPages = 3

// Jawaban yang sudah diterima diingat selama halaman terbuka: berpindah
// kategori bolak-balik di pustaka media tidak bertanya ulang ke server.
// (Server sendiri meng-cache jawaban Pixabay 24 jam.)
const fetched = new Map<string, Promise<StockMedia>>()

export function fetchStockMedia(category: LibraryCategory, page = 1): Promise<StockMedia> {
  const key = `${category}:${page}`
  let request = fetched.get(key)
  if (!request) {
    request = api<StockMedia>(`${stockMediaPath}?category=${encodeURIComponent(category)}&page=${page}`)
    fetched.set(key, request)
    // Yang gagal tidak diingat, supaya bisa dicoba lagi.
    request.catch(() => fetched.delete(key))
  }
  return request
}

export function fetchStockVideo(id: number) {
  return api<{ data: StockVideo }>(`${stockMediaPath}/videos/${id}`).then((result) => result.data)
}

/** Sisi terpanjang foto yang disimpan bersama halaman, sama dengan gambar unggahan (image-input.tsx). */
const maxSide = 1600

/**
 * Isi satu foto sebagai data URL, siap disimpan bersama halaman. PROTOTIPE:
 * kelak server yang menyimpannya ke media dan data halaman hanya memuat
 * alamat media-nya.
 */
export async function loadStockPhoto(id: number): Promise<string> {
  const image = new Image()
  image.src = `${stockMediaPath}/photos/${id}/file`
  await image.decode()
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(image.naturalWidth * scale)
  canvas.height = Math.round(image.naturalHeight * scale)
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/webp", 0.82)
}
