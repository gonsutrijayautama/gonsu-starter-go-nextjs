import { sanitizeCustomCss, sanitizeCustomHtml } from "../custom-html"
import type { CustomSectionProps } from "../custom-section"
import { stockPrefix } from "./custom-prompt"

// Jawaban AI untuk "Desain khusus" (HTML dan CSS) menjadi blok "Bagian
// khusus": satu blok per bagian, supaya tiap bagian bisa dipindah, dihapus,
// dan dicampur dengan blok biasa.

/** Foto atau video Pixabay yang dirujuk jawaban AI: isinya diambil sesudah diimpor (custom-designer.tsx). */
export type StockRef = { section: number; index: number; kind: "photo" | "video"; id: number }

export type CustomImport = {
  sections: CustomSectionProps[]
  stock: StockRef[]
  /** Yang diubah pengimpor dari jawaban AI, untuk diberitahukan sebelum dimasukkan. */
  notes: string[]
}

/** Satu halaman rancangan AI jauh di bawah ini; lebih dari ini hampir pasti bukan jawaban yang dimaksud. */
const maxLength = 400_000

/**
 * Isi jawaban AI. Jawaban yang terpotong lalu dilanjutkan ("lanjutkan") datang
 * dalam beberapa blok kode: isinya disambung. Tanpa blok kode, seluruh teks
 * dianggap HTML-nya (berkas halaman.html yang diunggah).
 */
export function extractHtml(text: string): string {
  const blocks = [...text.matchAll(/```([a-zA-Z]*)[^\n]*\n([\s\S]*?)(?:```|$)/g)].map(([, language, body]) =>
    language?.toLowerCase() === "css" ? `<style>${body}</style>` : (body ?? "")
  )
  return (blocks.length > 0 ? blocks.join("") : text).trim()
}

/** Id Pixabay dari isi data-photo atau data-video ("pixabay:12345"), atau null bila isinya keterangan biasa. */
function stockId(value: string): number | null {
  const text = value.trim()
  if (!text.startsWith(stockPrefix)) return null
  const id = Number(text.slice(stockPrefix.length))
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/** Elemen yang anak-anaknya adalah bagian halaman: AI sering membungkus semuanya dalam satu <main> atau <div>. */
function sectionsContainer(body: Element): Element {
  let container = body
  while (container.children.length === 1 && container.children[0]!.tagName !== "SECTION" && container.children[0]!.children.length > 0) {
    container = container.children[0]!
  }
  return container
}

export function importCustomHtml(text: string): CustomImport {
  const source = extractHtml(text)
  if (!source) throw new Error("Jawaban AI masih kosong.")
  if (source.length > maxLength) throw new Error("Jawaban AI terlalu panjang untuk satu halaman. Minta AI membuat halaman yang lebih ringkas.")
  const doc = new DOMParser().parseFromString(source, "text/html")
  const notes: string[] = []

  const styles = Array.from(doc.querySelectorAll("style"))
  const css = sanitizeCustomCss(styles.map((style) => style.textContent ?? "").join("\n"))
  styles.forEach((style) => style.remove())

  // AI yang tetap menulis <img> biasanya menunjuk gambar di internet: tempatnya dipertahankan sebagai tempat foto.
  const media = doc.querySelectorAll("img, picture, video")
  media.forEach((element) => {
    const slot = doc.createElement("div")
    slot.className = element.getAttribute("class") ?? ""
    slot.setAttribute("data-photo", element.getAttribute("alt") || "Foto")
    element.replaceWith(slot)
  })
  if (media.length > 0) notes.push(`${media.length} gambar dari AI diganti tempat foto. Unggah fotonya di panel kanan.`)
  doc.querySelectorAll("[data-photo]").forEach((slot) => {
    slot.classList.add("photo")
    slot.replaceChildren()
  })

  const container = sectionsContainer(doc.body)
  const chrome = container.querySelectorAll(":scope > header, :scope > nav, :scope > footer")
  chrome.forEach((element) => element.remove())
  if (chrome.length > 0) notes.push("Navbar dan kaki situs dari AI dilewati: situs ini sudah punya.")

  // Video hanya lewat tempat video: isinya dikosongkan seperti tempat foto.
  doc.querySelectorAll("[data-video]").forEach((slot) => {
    slot.classList.add("video")
    slot.replaceChildren()
  })

  let removed = 0
  const sections: CustomSectionProps[] = []
  const stock: StockRef[] = []
  for (const element of Array.from(container.children)) {
    const labels = (attribute: string) => Array.from(element.querySelectorAll(`[${attribute}]`)).map((slot) => (slot.getAttribute(attribute) ?? "").slice(0, 120))
    const photos = labels("data-photo").map((label) => ({ label, image: null }))
    const videos = labels("data-video").map((label) => ({ label, url: "" }))
    if (!element.textContent?.trim() && photos.length === 0 && videos.length === 0) continue
    for (const [kind, list] of [["photo", photos], ["video", videos]] as const) {
      list.forEach((item, index) => {
        const id = stockId(item.label)
        if (id !== null) stock.push({ section: sections.length, index, kind, id })
      })
    }
    const name = (element.getAttribute("data-name") || element.querySelector("h1, h2, h3")?.textContent || `Bagian ${sections.length + 1}`).trim().slice(0, 60)
    const clean = sanitizeCustomHtml(element.outerHTML)
    removed += clean.removed
    sections.push({ name, photos, videos, html: clean.html, css })
  }
  if (sections.length === 0) throw new Error("Tidak ada bagian halaman di jawaban AI. Pastikan yang ditempel adalah isi berkas halaman.html atau blok kode html-nya.")
  if (removed > 0) notes.push(`${removed} elemen atau atribut yang tidak diizinkan (skrip, formulir, tautan berbahaya) dibuang.`)
  return { sections, stock, notes }
}
