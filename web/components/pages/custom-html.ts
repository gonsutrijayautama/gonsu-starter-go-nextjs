import DOMPurify from "dompurify"

// Penyaring HTML dan CSS tulisan AI untuk blok "Bagian khusus".
//
// PROTOTIPE: penyaringan di peramban hanya melindungi peramban yang
// menjalankannya. Di produk sungguhan server wajib menyaring saat menyimpan —
// data halaman bisa dikirim tanpa lewat layar ini, dan hasilnya tampil di
// situs publik serta di kanvas editor yang satu asal dengan aplikasinya.

/** Kelas pembungkus isi di dalam shadow DOM; aturan CSS untuk body/html/:root dialihkan ke sini. */
export const customBodyClass = "custom-body"

const forbiddenTags = [
  "style", "script", "noscript", "template", "slot",
  "iframe", "frame", "frameset", "object", "embed",
  "form", "input", "textarea", "select", "option",
  "link", "meta", "base",
  // Gambar hanya lewat tempat foto ([data-photo]) yang diisi isian unggah.
  "img", "picture", "source", "video", "audio", "track", "canvas", "image",
  "dialog", "foreignObject", "use", "animate", "set", "animateMotion", "animateTransform",
]

const forbiddenAttributes = ["src", "srcset", "action", "formaction", "background", "poster", "ping", "xlink:href"]

/**
 * DOMPurify memeriksa NILAI SETIAP ATRIBUT dengan pola ini, bukan hanya
 * tautan: nilai biasa (viewBox, d, lebar) harus tetap lolos. Bentuknya
 * mengikuti pola bawaan DOMPurify, dengan skema yang boleh dipersempit ke
 * https, surel, dan telepon — jadi javascript: dan data: ditolak.
 */
const allowedUri = /^(?:(?:https|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i

/** Nilai CSS yang memuat sesuatu dari luar. url() hanya untuk data gambar yang tertanam. */
const externalUrl = /url\(\s*(['"]?)(?!data:image\/(?:png|jpe?g|webp|gif|svg\+xml)[;,])[^)]*\)/gi
const imageSet = /(?:-webkit-)?image-set\([^)]*\)/gi

function cleanDeclarations(css: string): string {
  return css.replace(externalUrl, "none").replace(imageSet, "none")
}

let hooked = false

/** DOMPurify hanya ada di peramban, jadi kaitnya dipasang saat pertama dipakai, bukan saat modul dimuat. */
function purifier() {
  if (!hooked) {
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      const style = node.getAttribute("style")
      if (style) node.setAttribute("style", cleanDeclarations(style))
      if (node.tagName === "A" && node.hasAttribute("target")) node.setAttribute("rel", "noopener noreferrer")
    })
    hooked = true
  }
  return DOMPurify
}

/** HTML tanpa skrip, penangan kejadian, bingkai, formulir, gambar dari luar, dan tautan berbahaya. */
export function sanitizeCustomHtml(html: string): { html: string; removed: number } {
  const purify = purifier()
  const clean = purify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true },
    FORBID_TAGS: forbiddenTags,
    FORBID_ATTR: forbiddenAttributes,
    ALLOWED_URI_REGEXP: allowedUri,
  })
  return { html: clean, removed: purify.removed.length }
}

const pageSelector = /(^|[\s,>+~(])(?:html|body|:root)(?=$|[\s,.:#[>+~)])/g

/** Aturan CSS satu per satu, sesudah dibaca dan ditulis ulang oleh pengurai CSS peramban. */
function rewrite(rules: CSSRuleList): string {
  return Array.from(rules)
    .map((rule) => {
      // @import tidak pernah dipakai: lembar gaya dari luar bisa memuat apa saja.
      if (rule instanceof CSSImportRule) return ""
      if (rule instanceof CSSStyleRule) {
        // Gaya untuk seluruh halaman (body, html, :root) hanya berlaku di dalam bagian ini.
        rule.selectorText = rule.selectorText.replace(pageSelector, `$1.${customBodyClass}`)
        return cleanDeclarations(rule.cssText)
      }
      if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule) {
        const head = rule.cssText.slice(0, rule.cssText.indexOf("{"))
        return `${head}{\n${rewrite(rule.cssRules)}\n}`
      }
      return cleanDeclarations(rule.cssText)
    })
    .join("\n")
}

/**
 * CSS yang tidak bisa memuat apa pun dari luar. Diurai pengurai CSS peramban
 * lebih dulu: hasil tulis ulangnya sudah baku, jadi `u\72l(…)` dan penyamaran
 * sejenis sudah menjadi `url(…)` saat diperiksa.
 */
export function sanitizeCustomCss(css: string): string {
  const sheet = new CSSStyleSheet()
  try {
    sheet.replaceSync(css.replace(/<\/?style[^>]*>/gi, ""))
  } catch {
    return ""
  }
  return rewrite(sheet.cssRules)
}
