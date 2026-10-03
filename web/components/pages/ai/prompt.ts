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
const recipes: [RegExp, string][] = [
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
      return `${indent}${key}: ${typeOf(spec)} — ${spec.label}${choices}`
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
    { "type": "Hero", "props": { "variant": "split", "badge_text": "Buka setiap hari 10.00–22.00", "title": "Bakso urat hangat,", "highlight": "kuah kaldu 8 jam", "effect": "accent",
      "subtitle": "Bakso urat kenyal dan mie buatan sendiri. Makan di tempat atau pesan antar ke rumah.", "primary_label": "Pesan lewat WhatsApp", "primary_link": "#kontak",
      "secondary_label": "Lihat menu", "secondary_link": "#menu", "image": null, "proof": "yes", "proof_rating": 4.8, "proof_text": "Disukai 2.000+ pelanggan di Bandung",
      "appearance": { "background": "color", "color": "#fff7ed", "pattern": "dots" } } },
    { "type": "Features", "props": { "layout": "icons", "eyebrow": "Kenapa kami", "title": "Rasa yang bikin kangen", "subtitle": "",
      "items": [ { "icon": "flame", "title": "Kuah 8 jam", "description": "Kaldu sapi dimasak perlahan sejak subuh." },
                 { "icon": "wheat", "title": "Mie buatan sendiri", "description": "Kenyal, tanpa pengawet, dibuat setiap pagi." },
                 { "icon": "truck", "title": "Antar 30 menit", "description": "Gratis ongkir untuk 3 km pertama." } ],
      "appearance": { "background": "none" } } }
  ]
}`

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
    "1. 6–9 bagian. Mulai dengan Hero (beranda/promo) atau PageTitle (halaman dalam); akhiri dengan CallToAction atau Location.",
    '2. Ritme latar: selang-seling "none" dan "muted"/"color"; jangan dua bagian berwarna kuat berturut-turut; paling banyak dua bagian "inverse".',
    "3. Variasikan susunan: jangan memakai susunan yang sama di dua bagian berurutan.",
    "4. Daftar berisi 3–6 butir, kecuali menu/harga yang boleh lebih banyak.",
    '5. Animasi muncul (appearance.reveal) "up" atau "fade" untuk sebagian bagian; jangan berlebihan.',
    design
      ? '6. Bagian buatan sendiri dimulai dengan "Section" (atur appearance-nya), lalu isi slot "content" dengan Heading, Paragraph, Columns, Grid, Card, Button, dan seterusnya. Jaga tetap rapi: paling dalam 3 tingkat.'
      : null,
    "",
    "## Aturan isi",
    "1. Bahasa Indonesia sesuai gaya bahasa di atas. Isi nyata dan spesifik untuk usaha ini, bukan teks contoh: sebut produk, keunggulan, angka, dan nama tempat bila wajar.",
    "2. Judul paling banyak 8 kata; kalimat di bawah judul paling banyak 25 kata; tombol berupa kata kerja (Pesan sekarang, Lihat menu).",
    "3. ISI SEMUA isian teks dan daftar yang tampil di susunan yang kamu pilih. Hanya isian gambar dan isian yang tidak dipakai susunan itu yang boleh dihilangkan.",
    '4. Hanya pakai "type" dari katalog, dan hanya nilai yang tertulis untuk isian pilihan (mis. "yes" | "no").',
    "5. Isian gambar selalu null — pemilik usaha mengunggah fotonya sendiri.",
    `6. Ikon memakai nama ikon Lucide (huruf kecil, tanda hubung), misalnya: ${popularIcons.slice(0, 50).join(", ")}.`,
    '7. Tautan berupa "#kontak", "/nama-halaman", atau alamat https://. Harga ditulis sebagai teks ("Rp25.000"), kecuali isian bertipe angka.',
    "8. Isian HTML hanya boleh memakai <p>, <strong>, <em>, <ul>, <ol>, <li>, dan <a>.",
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
