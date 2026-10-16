"use client"

import { createContext, use, useCallback, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react"
import { registerOverlayPortal, type PuckContext } from "@puckeditor/core"
import { ImagePlusIcon, VideoIcon } from "lucide-react"
import { cn } from "cn"

// Gambar dan video blok bisa diganti langsung dari kanvas editor: areanya
// didaftarkan sebagai overlay portal Puck, jadi kliknya sampai ke sini dan
// tidak hanya memilih blok. Editor yang membuka dialog media dan menulis
// hasilnya ke blok; di halaman terbit konteks ini kosong dan medianya diam.

export type MediaKind = "image" | "video"

/** `element`: untuk mencari blok pemiliknya. `field`: jalur isiannya di props blok ("image", "items.2.image", "url"). */
export type MediaPick = (target: { element: HTMLElement; field: string; kind: MediaKind }) => void

export const MediaPickContext = createContext<MediaPick | null>(null)

/**
 * Jalur isian gambar satu butir daftar. Daftar yang sudah disaring untuk
 * ditampilkan tetap menunjuk butir aslinya: `itemField("items", items, item)`.
 */
export function itemField<T>(list: string, all: readonly T[], item: T, key = "image"): string | undefined {
  const index = all.indexOf(item)
  return index < 0 ? undefined : `${list}.${index}.${key}`
}

/** Geseran sejauh ini sesudah menekan berarti blok sedang diseret, bukan medianya diklik. */
const dragDistance = 6

/**
 * Props untuk area media yang bisa diklik di kanvas, atau null di luar
 * editor. Menyeret blok dari area itu tetap jalan: yang membuka dialog hanya
 * klik di tempat.
 */
export function useMediaPick(puck: PuckContext, field: string | undefined, kind: MediaKind = "image") {
  const pick = use(MediaPickContext)
  const active = Boolean(puck.isEditing && pick && field)
  const pressed = useRef<{ x: number; y: number } | null>(null)
  const ref = useCallback(
    (element: HTMLElement | null) => {
      if (!active || !element) return
      return registerOverlayPortal(element, { disableDrag: false, disableDragOnFocus: false })
    },
    [active]
  )
  if (!puck.isEditing || !pick || !field) return null
  return {
    ref,
    role: "button" as const,
    tabIndex: 0,
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      pressed.current = { x: event.clientX, y: event.clientY }
    },
    onClick: (event: MouseEvent<HTMLElement>) => {
      // Klik ini tidak diteruskan ke pembungkusnya (tautan, tombol perbesar).
      event.preventDefault()
      event.stopPropagation()
      const start = pressed.current
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > dragDistance) return
      pick({ element: event.currentTarget, field, kind })
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return
      event.preventDefault()
      event.stopPropagation()
      pick({ element: event.currentTarget, field, kind })
    },
  }
}

/**
 * Tombol kecil untuk media yang areanya tidak dijadikan area klik: gambar
 * LATAR (menutupi seluruh blok, jadi setiap klik di blok itu akan membuka
 * dialog), slide yang digeser dengan menyeret, dan video yang sudah terisi.
 * Induknya harus `relative`.
 */
export function MediaPickButton({
  puck,
  field,
  filled,
  kind = "image",
  className,
}: {
  puck: PuckContext
  field: string | undefined
  filled: boolean
  kind?: MediaKind
  className?: string
}) {
  const pick = use(MediaPickContext)
  const active = Boolean(puck.isEditing && pick && field)
  const ref = useCallback(
    (element: HTMLButtonElement | null) => {
      if (!active || !element) return
      return registerOverlayPortal(element, { disableDrag: true })
    },
    [active]
  )
  if (!puck.isEditing || !pick || !field) return null
  const Icon = kind === "video" ? VideoIcon : ImagePlusIcon
  const noun = kind === "video" ? "video" : "gambar"
  return (
    <button
      ref={ref}
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        pick({ element: event.currentTarget, field, kind })
      }}
      className={cn(
        "absolute z-10 inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur outline-none hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {filled ? `Ganti ${noun}` : `Pilih ${noun}`}
    </button>
  )
}

const missing = Symbol("missing")

function replaceAt(source: unknown, path: string[], value: unknown): unknown {
  const [key, ...rest] = path
  if (key === undefined) return value
  if (Array.isArray(source)) {
    const index = Number(key)
    if (!Number.isInteger(index) || index < 0 || index >= source.length) return missing
    const next = replaceAt(source[index], rest, value)
    return next === missing ? missing : source.map((item, at) => (at === index ? next : item))
  }
  if (source === null || typeof source !== "object") return missing
  const record = source as Record<string, unknown>
  // Isian yang belum pernah diisi boleh belum ada; wadahnya harus ada.
  if (rest.length > 0 && !(key in record)) return missing
  const next = replaceAt(record[key], rest, value)
  return next === missing ? missing : { ...record, [key]: next }
}

/** Salinan `props` dengan nilai di `field` diganti, atau null bila jalurnya tidak ada (butirnya sudah dihapus). */
export function withValueAt<P extends Record<string, unknown>>(props: P, field: string, value: string | null): P | null {
  const next = replaceAt(props, field.split("."), value)
  return next === missing ? null : (next as P)
}

/** Teks yang sekarang ada di `field`, bila ada. */
export function valueAt(props: Record<string, unknown>, field: string): string | null {
  let value: unknown = props
  for (const key of field.split(".")) {
    if (value === null || typeof value !== "object") return null
    value = (value as Record<string, unknown>)[key]
  }
  return typeof value === "string" && value ? value : null
}
