import type { Site } from "@/lib/site"

import { popularIcons } from "../popular-icons"
import { appearanceSpec, type BlockSpec, type FieldSpec } from "./catalog"

// Prompt untuk ChatGPT atau Claude versi web: arahan desain, data usaha,
// jawaban pengguna di wizard, contoh hasil yang bagus, dan katalog blok. AI
// menjawab dengan berkas atau blok kode JSON yang diimpor lewat import.ts.

export type DesignStyle = "minimal" | "bold" | "warm" | "elegant" | "playful"

export type Brief = {
  mode: "new" | "revise"
  /** "design": AI boleh menyusun bagian sendiri dari komponen (Desain bebas). */
  build: "blocks" | "design"
  page: string
  business: string
  offer: string
  audience: string
  tone: string
  style: DesignStyle
  color: string
  blocks: string[]
  notes: string
}

/** Arahan visual setiap gaya desain, dalam nilai yang ada di katalog. */
export const styleGuides: Record<DesignStyle, { label: string; hint: string; rules: string }> = {
  minimal: {
    label: "Minimalis bersih",
    hint: "Banyak ruang kosong, tenang, rapi",
    rules:
      'Latar kebanyakan "none" dan "muted"; pola paling banyak "dots" di satu bagian. Efek kata disorot "accent", efek tombol "none". Hero "centered" atau "split". Kalimat pendek dan lugas.',
  },
  bold: {
    label: "Modern & berani",
    hint: "Kontras tinggi, efek bergerak",
    rules:
      'Hero "mockup" atau "background" dengan pola "grid" atau "retro". Efek kata disorot "gradient" atau "rotate", efek tombol "shine". Satu bagian berlatar "inverse". Ajakan pakai susunan "gradient" dengan warna merek.',
  },
  warm: {
    label: "Hangat & ramah",
    hint: "Lembut, akrab, banyak testimoni",
    rules:
      'Latar "muted" dan "color" dengan warna merek versi pucat (mis. krem, peach). Pola "dots" atau "glow". Testimoni "single" atau "carousel" dengan bintang. Efek kata disorot "accent".',
  },
  elegant: {
    label: "Elegan & mewah",
    hint: "Gelap, foto besar, sedikit kata",
    rules:
      'Hero "background" atau "split". Dua bagian berlatar "inverse". Pola "none" atau "glow". Efek kata disorot "shine", efek tombol "none". Kalimat singkat dan berkelas; hindari tanda seru.',
  },
  playful: {
    label: "Ceria & berwarna",
    hint: "Gradien, warna cerah, bergerak",
    rules:
      'Latar "gradient" dan "color" dengan warna cerah turunan warna merek. Pola "aurora" atau "meteors" di satu bagian. Efek kata disorot "aurora" atau "rotate", efek tombol "rainbow" atau "pulse". Testimoni "marquee".',
  },
}

/** Urutan bagian yang disarankan menurut jenis halaman (nama "type"). */
export const recipes: [RegExp, string][] = [
  [/beranda/i, "Hero → Logos atau Stats → Features → Services atau PriceList → Testimonials → Faq → CallToAction → Location"],
  [/layanan/i, "PageTitle → Services → Steps → Pricing → Testimonials → Faq → CallToAction"],
  [/menu|harga/i, "PageTitle atau Hero → PriceList → Promo → Reviews atau Testimonials → Location"],
  [/tentang/i, "PageTitle → About (story) → Stats → History → Team → About (mission) → CallToAction"],
  [/promo/i, "Hero atau Promo → Features → PriceList atau Pricing → Faq → CallToAction"],
  [/kontak|lokasi/i, "PageTitle → Contact → Location → Faq"],
  [/portofolio/i, "PageTitle → Portfolio → BeforeAfter → Testimonials → CallToAction"],
]

const quote = (value: string) => JSON.stringify(value)

/** Jenis isian dalam satu baris (daftar dan wadah ditulis bertingkat oleh `fieldLines`). */
function typeOf(spec: Exclude<FieldSpec, { kind: "list" | "slot" }>): string {
  switch (spec.kind) {
    case "text":
      return spec.long ? "teks (boleh beberapa baris, pisahkan dengan \\n)" : "teks"
    case "html":
      return "HTML sederhana"
    case "number":
      return spec.min !== undefined || spec.max !== undefined ? `angka ${spec.min ?? ""}–${spec.max ?? ""}` : "angka"
    case "enum":
      return spec.options.map((option) => quote(option.value)).join(" | ")
    case "image":
      return "null"
    case "icon":
      return "nama ikon"
    case "color":
      return '"#RRGGBB" atau ""'
    case "date":
      return '"YYYY-MM-DD"'
  }
}

/** Satu baris per isian; daftar ditulis bertingkat dengan isian setiap butirnya di bawahnya. */
function fieldLines(fields: Record<string, FieldSpec>, depth = 1): string {
  const indent = "  ".repeat(depth)
  return Object.entries(fields)
    .map(([key, spec]) => {
      if (spec.kind === "list") {
        return `${indent}${key}: daftar${spec.max ? ` (maks ${spec.max})` : ""} — ${spec.label}; setiap butir:\n${fieldLines(spec.item, depth + 1)}`
      }
      if (spec.kind === "slot") {
        return `${indent}${key}: daftar komponen { "type", "props" } — ${spec.label}; boleh: ${spec.allow.join(", ")}`
      }
      const choices =
        spec.kind === "enum" && spec.options.some((option) => option.label !== option.value)
          ? ` (${spec.options.map((option) => `${option.value} = ${option.label}`).join("; ")})`
          : ""
      const hint = spec.kind === "text" && spec.hint ? ` (petunjuk: ${spec.hint})` : ""
      return `${indent}${key}: ${typeOf(spec)} — ${spec.label}${choices}${hint}`
    })
    .join("\n")
}

function catalogText(catalog: BlockSpec[]): string {
  let group = ""
  return catalog
    .map((block) => {
      const heading = block.group !== group ? `\n### Kelompok: ${block.group}\n` : ""
      group = block.group
      return `${heading}\n"${block.type}" — ${block.label}\n${fieldLines(block.fields)}`
    })
    .join("\n")
}

/** Contoh hasil yang bagus: pendek, tapi menunjukkan isi spesifik, variasi susunan, dan ritme latar. */
const example = `{
  "content": [
    { "type": "Hero", "props": { "variant": "split", "badge_text": "Konsultasi lewat WhatsApp", "title": "Dikerjakan rapi,", "highlight": "selesai tepat waktu", "effect": "accent",
      "subtitle": "Ceritakan kebutuhan Anda; pilihan dan harganya kami jelaskan sebelum mulai.", "primary_label": "Hubungi lewat WhatsApp", "primary_link": "#kontak",
      "secondary_label": "Lihat layanan", "secondary_link": "#layanan", "image": null, "proof": "no",
      "appearance": { "background": "color", "color": "#fff7ed", "pattern": "dots" } } },
    { "type": "Features", "props": { "layout": "icons", "eyebrow": "Kenapa kami", "title": "Alasan pelanggan kembali lagi", "subtitle": "",
      "items": [ { "icon": "clock", "title": "Tepat waktu", "description": "Jadwal disepakati di awal, lalu ditepati." },
                 { "icon": "message-circle", "title": "Mudah dihubungi", "description": "Tanya dulu lewat WhatsApp sebelum memesan." },
                 { "icon": "badge-check", "title": "Dicek ulang", "description": "Setiap pekerjaan diperiksa sebelum diserahkan." } ],
      "appearance": { "background": "none" } } }
  ]
}`

/** Aturan desain halaman baru, sama untuk wizard (`buildPrompt`) dan chat (`buildChatGuide`). */
const designRules = [
  "1. 6–9 bagian. Mulai dengan Hero (beranda/promo) atau PageTitle (halaman dalam); akhiri dengan CallToAction atau Location.",
  '2. Ritme latar: selang-seling "none" dan "muted"/"color"; jangan dua bagian berwarna kuat berturut-turut; paling banyak dua bagian "inverse".',
  "3. Variasikan susunan: jangan memakai susunan yang sama di dua bagian berurutan.",
  "4. Daftar berisi 3–6 butir, kecuali daftar harga yang boleh lebih banyak.",
  '5. Animasi muncul (appearance.reveal) "up" atau "fade" untuk sebagian bagian; jangan berlebihan.',
]

/** Aturan isi nomor 2–8. Aturan pertama (bahasa dan kekhususan isi) berbeda antara wizard dan chat. */
const contentRules = [
  "2. Judul paling banyak 8 kata; kalimat di bawah judul paling banyak 25 kata; tombol berupa kata kerja (Hubungi kami, Lihat layanan).",
  "3. ISI SEMUA isian teks dan daftar yang tampil di susunan yang kamu pilih. Hanya isian gambar dan isian yang tidak dipakai susunan itu yang boleh dihilangkan.",
  '4. Hanya pakai "type" dari katalog, dan hanya nilai yang tertulis untuk isian pilihan (mis. "yes" | "no").',
  "5. Isian gambar selalu null — pemilik usaha mengunggah fotonya sendiri.",
  `6. Ikon memakai nama ikon Lucide (huruf kecil, tanda hubung), misalnya: ${popularIcons.slice(0, 50).join(", ")}.`,
  '7. Tautan berupa "#kontak", "/nama-halaman", atau alamat https://. Harga ditulis sebagai teks ("Rp25.000"), kecuali isian bertipe angka.',
  "8. Isian HTML hanya boleh memakai <p>, <strong>, <em>, <ul>, <ol>, <li>, dan <a>.",
]

export function buildPrompt(brief: Brief, catalog: BlockSpec[], parts: BlockSpec[], site: Site, current?: unknown): string {
  const wanted = catalog.filter((block) => brief.blocks.includes(block.type)).map((block) => `${block.label} (${block.type})`)
  const services = site.services.map((service) => [service.title, service.description].filter(Boolean).join(": ")).filter(Boolean)
  const recipe = recipes.find(([pattern]) => pattern.test(brief.page))?.[1]
  const style = styleGuides[brief.style]
  const design = brief.build === "design"
  // null: baris yang tidak berlaku dibuang; "" adalah jeda antarbagian.
  const lines: (string | null)[] = [
    "Kamu desainer web dan penulis iklan berpengalaman untuk usaha kecil di Indonesia.",
    brief.mode === "revise"
      ? 'Perbaiki halaman di bagian "Halaman saat ini" sesuai permintaan: perbagus susunan, tampilan, dan kalimatnya.'
      : "Rancang satu halaman web yang menarik dan meyakinkan untuk usaha ini.",
    design
      ? "Pakai blok siap pakai dari katalog, dan bila perlu tampilan yang lebih khas, susun bagian sendiri dari komponen penyusun."
      : "Pakai HANYA blok siap pakai dari katalog di bawah.",
    "",
    "## Hasil yang diminta",
    "Buat berkas bernama halaman.json yang bisa diunduh, berisi data halaman dengan format di bawah.",
    "Bila kamu tidak bisa membuat berkas, tulis isinya utuh dalam SATU blok kode ```json — tanpa komentar di dalamnya.",
    'Jangan menulis penjelasan panjang. Bila jawabanmu terpotong, lanjutkan tepat dari karakter terakhir dalam blok kode baru saat diminta "lanjutkan".',
    "",
    "## Tentang usaha",
    `- Nama usaha: ${brief.business || site.name || "(belum diisi)"}`,
    site.industry ? `- Bidang: ${site.industry}` : null,
    site.contact.city ? `- Kota: ${site.contact.city}` : null,
    `- Produk/layanan: ${brief.offer || "(belum diisi)"}`,
    services.length > 0 ? `- Layanan di profil: ${services.join("; ")}` : null,
    site.summary ? `- Ringkasan usaha: ${site.summary}` : null,
    site.about.text ? `- Cerita usaha: ${site.about.text}` : null,
    site.tagline ? `- Slogan: ${site.tagline}` : null,
    brief.audience ? `- Pelanggan sasaran: ${brief.audience}` : null,
    "- Alamat, telepon, jam buka, dan media sosial sudah ada di sistem: blok Contact dan Location menampilkannya otomatis. Jangan menulisnya di isian lain.",
    "",
    "## Permintaan",
    brief.mode === "new" ? `- Jenis halaman: ${brief.page}` : null,
    brief.mode === "new" && recipe && wanted.length === 0 ? `- Urutan bagian yang disarankan (boleh disesuaikan): ${recipe}` : null,
    wanted.length > 0 ? `- Bagian yang wajib ada: ${wanted.join(", ")}. Tambah bagian lain yang membuat halaman lengkap.` : null,
    `- Gaya bahasa: ${brief.tone}`,
    `- Gaya desain: ${style.label}. ${style.rules}`,
    brief.color
      ? `- Warna merek: ${brief.color}. Pakai di 1–3 bagian lewat appearance ("color", atau "gradient" dengan warna turunannya); untuk latar lebar pakai versi pucatnya.`
      : null,
    brief.notes ? `- Catatan dari pemilik usaha: ${brief.notes}` : null,
    "",
    "## Aturan desain",
    ...designRules,
    design
      ? '6. Bagian buatan sendiri dimulai dengan "Section" (atur appearance-nya), lalu isi slot "content" dengan Heading, Paragraph, Columns, Grid, Card, Button, dan seterusnya. Jaga tetap rapi: paling dalam 3 tingkat.'
      : null,
    "",
    "## Aturan isi",
    "1. Bahasa Indonesia sesuai gaya bahasa di atas. Isi nyata dan spesifik untuk usaha ini, bukan teks contoh: sebut produk, keunggulan, dan nama tempat dari data usaha atau permintaan. Angka hanya bila tertulis di sana.",
    ...contentRules,
    "",
    "## Format dan contoh",
    'Bentuknya { "content": [ { "type": …, "props": { … } } ] }. Contoh dua bagian yang bagus:',
    "```json",
    example,
    "```",
    "",
    "## Tampilan bagian (di props.appearance setiap blok dan Section)",
    fieldLines(appearanceSpec),
    "",
    "## Katalog blok siap pakai",
    catalogText(catalog),
  ]
  if (design) {
    lines.push("", "## Komponen penyusun (untuk bagian buatan sendiri)", catalogText(parts))
  }
  if (brief.mode === "revise" && current) {
    lines.push(
      "",
      "## Halaman saat ini",
      'Nilai "gambar:N" adalah foto yang sudah diunggah: pertahankan apa adanya di blok yang sama.',
      "```json",
      JSON.stringify(current, null, 1),
      "```"
    )
  }
  return lines.filter((line): line is string => line !== null).join("\n")
}

/**
 * Contoh dua bagian untuk chat. Berbeda dari `example` milik wizard: tanpa
 * rating dan jumlah pelanggan, yang pada uji 2026-10-04 ditiru model menjadi
 * angka karangan.
 */
const chatExample = [
  '{ "type": "Hero", "props": { "variant": "split", "badge_text": "Layanan cepat dan rapi", "title": "Dikerjakan rapi,", "highlight": "selesai tepat waktu", "effect": "accent", "subtitle": "Pilihan dan harganya dijelaskan sebelum mulai.", "primary_label": "Hubungi lewat WhatsApp", "primary_link": "#kontak", "secondary_label": "Lihat layanan", "secondary_link": "#layanan", "image": null, "proof": "no", "appearance": { "background": "color", "color": "#fff7ed", "pattern": "dots" } } }',
  '{ "type": "Features", "props": { "layout": "icons", "eyebrow": "Kenapa kami", "title": "Alasan pelanggan kembali lagi", "subtitle": "", "items": [ { "icon": "clock", "title": "Tepat waktu", "description": "Jadwal disepakati di awal, lalu ditepati." }, { "icon": "badge-check", "title": "Bergaransi", "description": "Hasil yang kurang pas diperbaiki tanpa biaya." }, { "icon": "truck", "title": "Bisa diantar", "description": "Diantar ke alamat Anda di dalam kota." } ], "appearance": { "background": "none" } } }',
].join("\n")

/**
 * Bahan untuk asisten chat (remote.ts): data usaha, aturan desain dan isi,
 * dan katalog blok. Cara menjawabnya — perintah apa saja yang ada — ditentukan
 * server (internal/pageai), jadi tidak ditulis di sini.
 */
export function buildChatGuide(catalog: BlockSpec[], site: Site): string {
  const services = site.services.map((service) => [service.title, service.description].filter(Boolean).join(": ")).filter(Boolean)
  // Tanpa satu pun dari ini model tidak tahu usahanya menjual apa, dan pada uji 2026-10-04 ia menebak sendiri.
  const described = Boolean(site.industry || services.length > 0 || site.summary || site.about.text)
  const lines: (string | null)[] = [
    "## Tentang usaha",
    `- Nama usaha: ${site.name || "(belum diisi)"}`,
    site.industry ? `- Bidang: ${site.industry}` : null,
    site.contact.city ? `- Kota: ${site.contact.city}` : null,
    services.length > 0 ? `- Layanan di profil: ${services.join("; ")}` : null,
    site.summary ? `- Ringkasan usaha: ${site.summary}` : null,
    site.about.text ? `- Cerita usaha: ${site.about.text}` : null,
    site.tagline ? `- Slogan: ${site.tagline}` : null,
    described
      ? null
      : "- Bidang usaha dan produknya BELUM diisi di profil. Jangan menebak bidangnya dari nama usaha. Bila pengguna belum menyebut apa yang dijual atau dikerjakan usaha ini di percakapan, jangan ubah halaman: tanyakan dulu.",
    "- Alamat, telepon, jam buka, dan media sosial sudah ada di sistem: blok Contact dan Location menampilkannya otomatis. Jangan menulisnya di isian lain.",
    "",
    "## Urutan bagian yang disarankan untuk halaman baru (boleh disesuaikan)",
    ...recipes.map(([pattern, order]) => `- Halaman ${pattern.source.replaceAll("|", " atau ")}: ${order}`),
    "",
    "## Aturan desain untuk halaman baru",
    ...designRules,
    "",
    "## Aturan isi",
    "1. Bahasa Indonesia yang santai dan langsung, kecuali pengguna meminta gaya lain. Isi spesifik untuk usaha ini — produk dan keunggulannya dari data usaha — bukan kalimat umum yang cocok untuk usaha mana pun.",
    ...contentRules,
    '9. Testimoni, ulasan, logo mitra, angka capaian, penghargaan, anggota tim, harga, dan jam buka adalah fakta yang hanya diketahui pemilik usaha. Bila tidak ada di data usaha atau di percakapan, JANGAN mengarangnya dan jangan mengisinya dengan teks contoh: biarkan isiannya kosong ("" untuk teks, 0 untuk angka, [] untuk jam buka). Editor menandai isian kosong sebagai isian yang perlu diisi, dan pengunjung tidak melihatnya. Lalu sebut di kalimat untuk pengguna bagian mana yang perlu diisi sendiri.',
    "",
    "## Bentuk satu bagian dan contoh",
    'Satu bagian berbentuk { "type": …, "props": { … } }. Dua contoh bagian yang bagus (tiru bentuknya, jangan menyalin kalimatnya):',
    chatExample,
    "",
    "## Tampilan bagian",
    'Ditulis di props.appearance, bukan sejajar dengan isian lain. Setiap bagian baru menulis appearance-nya, paling sedikit "background".',
    fieldLines(appearanceSpec),
    "",
    "## Katalog blok siap pakai",
    catalogText(catalog),
  ]
  return lines.filter((line): line is string => line !== null).join("\n")
}
