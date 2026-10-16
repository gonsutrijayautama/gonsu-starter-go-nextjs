"use client"

import { use, useEffect, useRef } from "react"
import type { ComponentConfig, Fields } from "@puckeditor/core"

import { codeField } from "./code-field"
import { customBodyClass, sanitizeCustomCss, sanitizeCustomHtml } from "./custom-html"
import { imageField } from "./fields"
import { InCanvasContext } from "./stat-number"
import { isStockVideo } from "./video-source"

// Blok "Bagian khusus": satu bagian halaman berupa HTML dan CSS tulisan AI
// (Desain khusus di ai/custom-designer.tsx). Isinya dirender di dalam shadow
// DOM, jadi CSS-nya tidak menyentuh bagian lain di halaman dan gaya aplikasi
// tidak mengubah rancangannya; variabel tema (--primary, --background, …)
// tetap sampai ke dalam karena variabel CSS menembus shadow DOM.

export type CustomSectionProps = {
  name: string
  /** Satu entri per tempat foto ([data-photo]) di HTML, berurutan. */
  photos: { label: string; image: string | null }[]
  /** Satu entri per tempat video ([data-video]) di HTML, berurutan. `url` kosong: belum ada videonya. */
  videos: { label: string; url: string }[]
  html: string
  css: string
}

/** Penanda pembungkus blok ini di halaman, untuk mencari jangkar di dalam shadow DOM-nya. */
const hostAttribute = "data-custom-section"

const baseCss = `
:host { display: block; }
*, *::before, *::after { box-sizing: border-box; }
.${customBodyClass} { color: var(--foreground); font-family: inherit; line-height: 1.5; }
.photo { display: grid; place-items: center; min-height: 7.5rem; overflow: hidden; background: var(--muted); color: var(--muted-foreground); font-size: 0.75rem; text-align: center; }
.photo.has-photo > img { display: block; width: 100%; height: 100%; object-fit: cover; }
:host([data-editing]) .photo:not(.has-photo)::after { content: "Foto: " attr(data-photo); padding: 0.5rem; }
.video { display: grid; place-items: center; min-height: 10rem; overflow: hidden; background: var(--muted); color: var(--muted-foreground); font-size: 0.75rem; text-align: center; }
.video.has-video > video { display: block; width: 100%; height: 100%; object-fit: cover; }
:host([data-editing]) .video:not(.has-video)::after { content: "Video: " attr(data-video); padding: 0.5rem; }
`

/** Elemen ber-id itu di dokumen, atau di dalam salah satu bagian khusus. */
function findAnchor(doc: Document, id: string): Element | null {
  const direct = doc.getElementById(id)
  if (direct) return direct
  for (const host of doc.querySelectorAll(`[${hostAttribute}]`)) {
    const inside = host.shadowRoot?.getElementById(id)
    if (inside) return inside
  }
  return null
}

function CustomSectionBlock({ html, css, photos, videos }: CustomSectionProps) {
  const host = useRef<HTMLDivElement>(null)
  const editing = use(InCanvasContext)

  useEffect(() => {
    const element = host.current
    if (!element) return
    const doc = element.ownerDocument
    let root = element.shadowRoot
    if (!root) {
      root = element.attachShadow({ mode: "open" })
      // Jangkar ("#menu") tidak menembus shadow DOM dengan sendirinya: tujuannya dicari, lalu digulir ke sana.
      root.addEventListener("click", (event) => {
        const href = (event.target as Element | null)?.closest?.("a[href]")?.getAttribute("href") ?? ""
        if (href.length < 2 || !href.startsWith("#")) return
        event.preventDefault()
        findAnchor(doc, decodeURIComponent(href.slice(1)))?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
    }

    const style = doc.createElement("style")
    style.textContent = `${baseCss}\n${sanitizeCustomCss(css)}`
    const body = doc.createElement("div")
    body.className = customBodyClass
    // Disaring setiap kali dirender, bukan hanya saat diimpor: data halaman bisa berubah di luar pengimpor.
    body.innerHTML = sanitizeCustomHtml(html).html
    body.querySelectorAll<HTMLElement>("[data-photo]").forEach((slot, index) => {
      slot.classList.add("photo")
      const image = photos[index]?.image
      if (!image) return
      const picture = doc.createElement("img")
      picture.src = image
      picture.alt = slot.dataset.photo ?? ""
      slot.replaceChildren(picture)
      slot.classList.add("has-photo")
    })
    // Pengunjung yang meminta gerak dikurangi tidak disuguhi video yang berjalan sendiri.
    const calm = doc.defaultView?.matchMedia("(prefers-reduced-motion: reduce)").matches ?? false
    body.querySelectorAll<HTMLElement>("[data-video]").forEach((slot, index) => {
      slot.classList.add("video")
      // Blok yang dibuat sebelum ada video tidak punya daftar videonya.
      const address = videos?.[index]?.url ?? ""
      if (!isStockVideo(address)) return
      const player = doc.createElement("video")
      player.src = address
      player.muted = true
      player.loop = true
      player.playsInline = true
      player.preload = "metadata"
      player.autoplay = !calm
      player.controls = calm
      slot.replaceChildren(player)
      slot.classList.add("has-video")
    })
    root.replaceChildren(style, body)
  }, [html, css, photos, videos])

  // contain-paint: elemen "position: fixed" dan z-index dari CSS-nya tidak bisa keluar dari bagian ini.
  return <div ref={host} {...{ [hostAttribute]: "" }} data-editing={editing ? "" : undefined} className="relative block contain-paint" />
}

export const customSectionConfig: ComponentConfig<CustomSectionProps> = {
  label: "Bagian khusus",
  fields: {
    name: { type: "text", label: "Nama bagian" },
    photos: {
      type: "array",
      label: "Foto",
      getItemSummary: (photo, index) => photo.label || `Foto ${(index ?? 0) + 1}`,
      defaultItemProps: { label: "", image: null },
      arrayFields: { image: imageField("Foto"), label: { type: "text", label: "Keterangan foto" } },
    },
    videos: {
      type: "array",
      label: "Video",
      getItemSummary: (video, index) => video.label || `Video ${(index ?? 0) + 1}`,
      defaultItemProps: { label: "", url: "" },
      arrayFields: {
        url: { type: "text", label: "Alamat video dari Pixabay", placeholder: "https://cdn.pixabay.com/video/…" },
        label: { type: "text", label: "Keterangan video" },
      },
    },
    html: codeField("Kode HTML", "html"),
    css: codeField("Kode CSS", "css"),
  },
  // Jumlah foto dan video mengikuti tempatnya di HTML: tidak bisa ditambah atau dikurangi dari sini.
  resolveFields: (data, { fields }) => {
    const all = fields as Fields<CustomSectionProps>
    const fixed = (key: "photos" | "videos") => {
      const count = data.props[key]?.length ?? 0
      return count === 0 ? [] : [[key, { ...all[key], min: count, max: count }] as const]
    }
    return Object.fromEntries(
      Object.entries(all).flatMap(([key, field]) => (key === "photos" || key === "videos" ? fixed(key) : [[key, field] as const]))
    ) as Fields<CustomSectionProps>
  },
  defaultProps: { name: "Bagian khusus", photos: [], videos: [], html: "", css: "" },
  render: (props) => <CustomSectionBlock {...props} />,
}
