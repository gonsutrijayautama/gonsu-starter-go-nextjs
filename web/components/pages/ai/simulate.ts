import type { Site } from "@/lib/site"

import type { ChatEvent, DesignRequest, Designer } from "./chat"
import { recipes } from "./prompt"

// SIMULASI penyusun halaman, dipakai bila server tidak punya kunci model AI
// (remote.ts), supaya layar chat tetap bisa dicoba dan diuji. Tidak ada model
// di sini: permintaan dikenali dari kata kuncinya, dan bagiannya memakai isi
// contoh setiap blok.

export type Plan = {
  /** Kalimat jawaban. */
  text: string
  /** Halaman dikosongkan dulu: permintaannya halaman baru. */
  clear: boolean
  /** Bagian yang ditambahkan, berurutan dari atas. */
  insert: { type: string; props: Record<string, unknown> }[]
  /** Urutan bagian yang dibuang, pada halaman saat permintaan dikirim. */
  remove: number[]
}

/** Kata yang dipakai orang untuk menyebut satu blok. */
const names: [RegExp, string][] = [
  [/\b(faq|tanya jawab|pertanyaan)\b/, "Faq"],
  [/\b(testimoni|kata pelanggan)\b/, "Testimonials"],
  [/\bulasan\b/, "Reviews"],
  [/\b(galeri|foto)\b/, "Gallery"],
  [/\bportofolio\b/, "Portfolio"],
  [/\b(menu|daftar harga)\b/, "PriceList"],
  [/\bpaket\b/, "Pricing"],
  [/\bpromo\b/, "Promo"],
  [/\b(fitur|keunggulan)\b/, "Features"],
  [/\blayanan\b/, "Services"],
  [/\b(langkah|cara pesan)\b/, "Steps"],
  [/\b(tentang|cerita)\b/, "About"],
  [/\btim\b/, "Team"],
  [/\bsejarah\b/, "History"],
  [/\b(logo|mitra)\b/, "Logos"],
  [/\b(angka|capaian|statistik)\b/, "Stats"],
  [/\b(penghargaan|sertifikat)\b/, "Awards"],
  [/\b(ajakan|cta)\b/, "CallToAction"],
  [/\bkontak\b/, "Contact"],
  [/\b(lokasi|jam buka|peta)\b/, "Location"],
  [/\b(pembuka|hero)\b/, "Hero"],
]

const removing = /\b(hapus(kan)?|buang|hilangkan)\b/
const adding = /\b(tambah(kan)?|sisipkan|masukkan)\b/
const creating = /\b(buat(kan)?|susun(kan)?|rancang(kan)?|desain(kan)?)\b/

const hint =
  "Simulasi ini baru mengerti tiga permintaan: membuat halaman (“Buatkan halaman layanan”), menambah bagian (“Tambahkan tanya jawab”), dan membuang bagian (“Hapus testimoni”). Permintaan lain butuh AI sungguhan, yang belum diaktifkan di server ini."

/** Jenis blok di resep "Hero → Logos atau Stats → About (story)": pilihan pertama, tanpa keterangannya. */
function recipeTypes(recipe: string): string[] {
  return recipe.split("→").map((part) => (part.split(" atau ")[0] ?? "").replace(/\(.*\)/, "").trim())
}

function list(labels: string[]): string {
  if (labels.length <= 1) return labels.join("")
  return `${labels.slice(0, -1).join(", ")} dan ${labels.at(-1)}`
}

/** Isian yang diambil dari profil usaha; sisanya isi contoh blok itu. Latar berselang-seling supaya bagian terbaca terpisah. */
function propsFor(type: string, site: Site, position: number): Record<string, unknown> {
  const props: Record<string, unknown> = { appearance: { background: position % 2 === 1 ? "muted" : "none" } }
  if (type === "Hero") {
    if (site.tagline || site.name) props.title = site.tagline || site.name
    if (site.summary) props.subtitle = site.summary
  }
  if (type === "Services" && site.services.length > 0) {
    props.items = site.services.map((service) => ({ title: service.title, description: service.description }))
  }
  if (type === "About" && site.about.text) props.body = site.about.text
  return props
}

/** Apa yang dilakukan untuk satu permintaan. Tanpa jeda dan tanpa efek samping, supaya mudah diperiksa. */
export function planReply({ prompt, site, current, catalog }: DesignRequest): Plan {
  const text = prompt.toLowerCase()
  const known = new Set(catalog.map((block) => block.type))
  const label = (type: string) => catalog.find((block) => block.type === type)?.label ?? type
  const mentioned = names.filter(([pattern, type]) => known.has(type) && pattern.test(text)).map(([, type]) => type)
  const nothing = { clear: false, insert: [], remove: [] }

  if (removing.test(text)) {
    const remove = current.flatMap((item, index) => (mentioned.includes(item.type) ? [index] : []))
    if (remove.length === 0) {
      return { ...nothing, text: mentioned.length > 0 ? `Tidak ada bagian ${list(mentioned.map(label))} di halaman ini.` : hint }
    }
    const removed = [...new Set(remove.map((index) => label(current[index]!.type)))]
    return { ...nothing, remove, text: `Bagian ${list(removed)} sudah saya buang dari halaman.` }
  }

  if (adding.test(text)) {
    if (mentioned.length === 0) return { ...nothing, text: hint }
    return {
      ...nothing,
      insert: mentioned.map((type, index) => ({ type, props: propsFor(type, site, current.length + index) })),
      text: `Bagian ${list(mentioned.map(label))} sudah saya tambahkan di bawah halaman. Sesuaikan isinya di panel kanan.`,
    }
  }

  // Halaman yang sudah berisi tidak diganti tanpa diminta dengan jelas.
  if (current.length > 0 && !creating.test(text)) return { ...nothing, text: hint }

  const recipe = recipes.find(([pattern]) => pattern.test(text)) ?? recipes[0]!
  const types = recipeTypes(recipe[1]).filter((type) => known.has(type))
  return {
    clear: true,
    remove: [],
    insert: types.map((type, index) => ({ type, props: propsFor(type, site, index) })),
    text: `Halaman sudah saya susun: ${types.length} bagian, dari ${label(types[0] ?? "")} sampai ${label(types.at(-1) ?? "")}. Periksa isinya, unggah fotonya, lalu simpan draf.`,
  }
}

/** Jeda yang berakhir dengan galat begitu percakapan dihentikan. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    const stop = () => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", stop)
      resolve()
    }, ms)
    signal.addEventListener("abort", stop, { once: true })
  })
}

/** Rencana `planReply` dialirkan dengan jeda, meniru jawaban AI yang datang sedikit demi sedikit. */
export const simulateDesigner: Designer = async function* (request, signal): AsyncGenerator<ChatEvent> {
  const plan = planReply(request)
  const label = (type: string) => request.catalog.find((block) => block.type === type)?.label ?? type

  yield { type: "step", id: "read", label: "Membaca profil usaha dan isi halaman" }
  await wait(600, signal)

  if (plan.clear) yield { type: "clear" }

  for (const index of plan.remove) {
    yield { type: "step", id: "remove", label: `Membuang ${label(request.current[index]?.type ?? "")}` }
    await wait(350, signal)
    yield { type: "remove", id: request.current[index]?.id ?? "" }
  }
  if (plan.remove.length > 0) yield { type: "step", id: "remove", label: `${plan.remove.length} bagian dibuang` }

  for (const [position, item] of plan.insert.entries()) {
    yield { type: "step", id: "build", label: `Menyusun ${label(item.type)} (${position + 1} dari ${plan.insert.length})` }
    await wait(350, signal)
    yield { type: "insert", item }
  }
  if (plan.insert.length > 0) yield { type: "step", id: "build", label: `${plan.insert.length} bagian disusun` }

  for (const [position, word] of plan.text.split(" ").entries()) {
    yield { type: "text", text: position === 0 ? word : ` ${word}` }
    await wait(20, signal)
  }
}
