import type { Data } from "@puckeditor/core"
import { iconNames } from "lucide-react/dynamic"

import { siteIcons } from "@/lib/site-icons"

import { appearanceSpec, type BlockSpec, type FieldSpec } from "./catalog"

// Memeriksa jawaban AI sebelum masuk ke editor. Pemaaf terhadap bentuk
// (JSON di dalam ```json, teks di sekitarnya, koma berlebih), tegas terhadap
// isi: blok dan nilai yang tidak dikenal diganti nilai bawaan, HTML disaring,
// tautan dan warna diperiksa. Hasilnya selalu data halaman yang sah.

type Item = { type: string; props: Record<string, unknown> }

export type ImportResult = { content: Item[]; warnings: string[] }

const knownIcons = new Set<string>([...iconNames, ...Object.keys(siteIcons)])
const hex = /^#[0-9a-f]{6}$/i
const placeholder = /^gambar:\d+$/

/** Mengurai satu teks JSON; koma sebelum } atau ] (sering ditulis AI) dibuang bila perlu. */
function parse(body: string): unknown {
  try {
    return JSON.parse(body)
  } catch {
    return JSON.parse(body.replace(/,\s*([}\]])/g, "$1"))
  }
}

/**
 * JSON dari jawaban AI. Jawaban panjang sering terpotong lalu dilanjutkan
 * ("lanjutkan") di blok kode baru: blok yang masing-masing utuh digabung
 * isinya, dan blok yang tidak utuh disambung dulu sebelum diurai.
 */
export function extractJson(text: string): unknown {
  const blocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)(?:```|$)/gi)].map((match) => (match[1] ?? "").trim()).filter(Boolean)
  const failure = new Error('Jawaban AI bukan JSON yang utuh. Bila terpotong, minta AI "lanjutkan" lalu tempel semua bagiannya; atau minta AI mengirim ulang.')
  if (blocks.length > 0) {
    const parsed = blocks.map((body) => {
      try {
        return parse(body)
      } catch {
        return undefined
      }
    })
    if (parsed.every((value) => value !== undefined)) {
      return parsed.length === 1 ? parsed[0] : { content: parsed.flatMap((value) => itemsOf(value)) }
    }
    try {
      return parse(blocks.join(""))
    } catch {
      throw failure
    }
  }
  const start = text.search(/[[{]/)
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"))
  if (start < 0 || end <= start) throw failure
  try {
    return parse(text.slice(start, end + 1))
  } catch {
    throw failure
  }
}

const allowedTags = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI", "A", "H2", "H3", "BLOCKQUOTE"])

function safeHref(href: string): boolean {
  return /^(\/|#|https:\/\/|mailto:|tel:)/.test(href.trim())
}

/** HTML hanya dengan tag teks yang aman; atribut dibuang kecuali href yang aman. */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html")
  const clean = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      const span = doc.createElement("span")
      span.textContent = node.textContent ?? ""
      return span.innerHTML
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return ""
    const element = node as Element
    const inner = Array.from(element.childNodes).map(clean).join("")
    if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "TEMPLATE"].includes(element.tagName)) return ""
    if (!allowedTags.has(element.tagName)) return inner
    const tag = element.tagName.toLowerCase()
    if (tag === "br") return "<br>"
    if (tag === "a") {
      const href = element.getAttribute("href") ?? ""
      if (!safeHref(href)) return inner
      const attribute = href.replace(/"/g, "&quot;")
      return `<a href="${attribute}">${inner}</a>`
    }
    return `<${tag}>${inner}</${tag}>`
  }
  return Array.from(doc.body.childNodes).map(clean).join("")
}

/** Nilai kosong yang wajar untuk isian yang tidak punya nilai bawaan. */
function emptyOf(spec: FieldSpec): unknown {
  switch (spec.kind) {
    case "number":
      return spec.min ?? 0
    case "enum":
      return spec.options[0]?.value ?? ""
    case "image":
      return null
    case "list":
    case "slot":
      return []
    default:
      return ""
  }
}

type Context = {
  warnings: string[]
  images: Map<string, string>
  where: string
  /** Semua blok dan komponen yang dikenal, untuk isi slot. */
  byType: Map<string, BlockSpec>
  depth: number
}

/** Batas kedalaman komponen bersarang dari AI: cukup untuk Bagian › Kolom › Kartu › isi. */
const maxDepth = 4

function valueOf(spec: FieldSpec, value: unknown, fallback: unknown, context: Context, key: string): unknown {
  if (value === undefined) return fallback
  switch (spec.kind) {
    case "text":
      return typeof value === "string" ? value.slice(0, 4000) : typeof value === "number" ? String(value) : fallback
    case "html":
      return typeof value === "string" ? sanitizeHtml(value) : fallback
    case "number": {
      const number = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(",", ".")) : NaN
      if (!Number.isFinite(number)) return fallback
      return Math.min(spec.max ?? Infinity, Math.max(spec.min ?? -Infinity, number))
    }
    case "enum": {
      const text = String(value)
      if (spec.options.some((option) => option.value === text)) return text
      context.warnings.push(`${context.where}: pilihan "${text}" untuk ${spec.label || key} tidak dikenal, dipakai nilai bawaan.`)
      return fallback
    }
    case "image":
      // AI tidak membuat gambar; "gambar:N" adalah foto lama yang dikembalikan (mode perbaiki).
      return typeof value === "string" && placeholder.test(value) ? (context.images.get(value) ?? null) : null
    case "icon":
      if (typeof value === "string" && knownIcons.has(value)) return value
      if (value) context.warnings.push(`${context.where}: ikon "${String(value)}" tidak ada, dipakai ikon bawaan.`)
      return fallback
    case "color":
      return typeof value === "string" && (value === "" || hex.test(value)) ? value.toLowerCase() : fallback
    case "date":
      return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback
    case "list": {
      if (!Array.isArray(value)) return fallback
      return value
        .slice(0, spec.max ?? 50)
        .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
        .map((entry) => propsOf(spec.item, entry, spec.itemDefaults, context))
    }
    case "slot": {
      if (!Array.isArray(value)) return fallback
      if (context.depth >= maxDepth) {
        context.warnings.push(`${context.where}: susunan terlalu dalam, isi ${spec.label || key} dilewati.`)
        return []
      }
      const allowed = new Set(spec.allow)
      return value
        .map((child, index) => itemOf(child, `${context.where} › ${index + 1}`, allowed, { ...context, depth: context.depth + 1 }))
        .filter((item): item is Item => item !== null)
    }
  }
}

function propsOf(
  fields: Record<string, FieldSpec>,
  input: Record<string, unknown>,
  defaults: Record<string, unknown>,
  context: Context
): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  for (const [key, spec] of Object.entries(fields)) {
    const fallback = key in defaults ? defaults[key] : emptyOf(spec)
    props[key] = valueOf(spec, input[key], fallback, context, key)
  }
  return props
}

/** Daftar blok dari bentuk apa pun yang lazim dikirim AI. */
function itemsOf(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === "object" && raw !== null) {
    const record = raw as Record<string, unknown>
    for (const key of ["content", "blocks", "sections"]) if (Array.isArray(record[key])) return record[key] as unknown[]
    if (typeof record.type === "string") return [record]
  }
  throw new Error('Tidak ada daftar blok di jawaban AI. Bentuk yang benar: { "content": [ … ] }.')
}

/** Satu blok atau komponen dari AI, atau null bila jenisnya tidak dikenal atau tidak boleh di tempat itu. */
function itemOf(entry: unknown, where: string, allowed: Set<string> | null, context: Context): Item | null {
  const record = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>
  const type = typeof record.type === "string" ? record.type : ""
  const block = context.byType.get(type)
  if (!block || (allowed && !allowed.has(type))) {
    context.warnings.push(`${where}: "${type || "tanpa nama"}" ${block ? "tidak boleh di tempat itu" : "tidak ada di aplikasi ini"}, dilewati.`)
    return null
  }
  const input = (typeof record.props === "object" && record.props !== null ? record.props : record) as Record<string, unknown>
  const inner = { ...context, where: `${where} (${block.label})` }
  const props = propsOf(block.fields, input, block.defaults, inner)
  // Tampilan bagian: hanya yang boleh diatur AI, sisanya nilai bawaan blok.
  const look = (block.defaults.appearance ?? null) as Record<string, unknown> | null
  if (look) {
    const asked = (typeof input.appearance === "object" && input.appearance !== null ? input.appearance : {}) as Record<string, unknown>
    props.appearance = { ...look, ...propsOf(appearanceSpec, asked, look, inner) }
  }
  return { type, props: { ...block.defaults, ...props, id: `${type}-${crypto.randomUUID()}` } }
}

/**
 * Jawaban AI menjadi isi halaman. `parts`: komponen penyusun yang boleh
 * dipakai (Desain bebas); tanpa itu hanya blok siap pakai.
 */
export function importBlocks(raw: unknown, catalog: BlockSpec[], images: Map<string, string> = new Map(), parts: BlockSpec[] = []): ImportResult {
  const byType = new Map([...parts, ...catalog].map((block) => [block.type, block]))
  const context: Context = { warnings: [], images, where: "", byType, depth: 0 }
  const content = itemsOf(raw)
    .map((entry, index) => itemOf(entry, `Bagian ${index + 1}`, null, context))
    .filter((item): item is Item => item !== null)
  if (content.length === 0) throw new Error("Tidak ada blok yang bisa dipakai dari jawaban AI.")
  return { content, warnings: context.warnings }
}

/**
 * Halaman sekarang untuk mode "perbaiki": tanpa id, dan foto diganti
 * "gambar:N" supaya prompt tidak memuat isi foto. `images` menyimpan
 * pasangannya untuk dikembalikan saat diimpor.
 */
export function exportForAi(data: Data, catalog: BlockSpec[], parts: BlockSpec[] = []): { content: unknown[]; images: Map<string, string> } {
  const images = new Map<string, string>()
  const byType = new Map([...parts, ...catalog].map((block) => [block.type, block]))
  const strip = (fields: Record<string, FieldSpec>, props: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const [key, spec] of Object.entries(fields)) {
      const value = props[key]
      if (spec.kind === "image") {
        if (typeof value === "string" && value) {
          const token = `gambar:${images.size + 1}`
          images.set(token, value)
          out[key] = token
        } else out[key] = null
      } else if (spec.kind === "list" && Array.isArray(value)) {
        out[key] = value.map((entry) => (typeof entry === "object" && entry !== null ? strip(spec.item, entry as Record<string, unknown>) : entry))
      } else if (spec.kind === "slot" && Array.isArray(value)) {
        out[key] = value.map(exportItem).filter(Boolean)
      } else out[key] = value
    }
    return out
  }
  function exportItem(item: unknown): unknown {
    const { type, props } = item as { type: string; props: Record<string, unknown> }
    const block = byType.get(type)
    if (!block) return null
    const look = props.appearance as Record<string, unknown> | undefined
    const appearance = look ? Object.fromEntries(Object.keys(appearanceSpec).map((key) => [key, look[key]])) : undefined
    return { type, props: { ...strip(block.fields, props), ...(appearance ? { appearance } : {}) } }
  }
  return { content: (data.content ?? []).map(exportItem).filter(Boolean), images }
}
