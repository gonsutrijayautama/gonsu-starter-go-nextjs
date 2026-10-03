"use client"

import Image from "next/image"
import { useEffect, useState, type CSSProperties } from "react"
import { PlayIcon, VideoIcon } from "lucide-react"
import { cn } from "cn"

import { IconTile } from "@/components/reui/icon-tile"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

import { BlockImage, elementFrame, type BlockProps } from "./blocks"
import { DeviceFrame, Marquee, type DeviceKind } from "./effects"
import { textOn } from "./appearance"
import { initials, type Align } from "./elements"
import { PageIcon } from "./page-icon"

// Komponen media dan efek bergaya Magic UI: video dengan dialog (Hero Video
// Dialog), tumpukan avatar (Avatar Circles), ikon mengorbit (Orbiting
// Circles), teks berjalan, dan notifikasi berjalan (Animated List).

const justify: Record<Align, string> = { left: "justify-start", center: "justify-center", right: "justify-end" }

function SiteIcon({ name }: { name: string }) {
  return <PageIcon name={name} />
}

// --- Video ------------------------------------------------------------------------------

export type VideoProps = { url: string; title: string; thumbnail: string | null; style: "dialog" | "inline"; frame: DeviceKind }

/** id video dari tautan YouTube (watch, youtu.be, embed, shorts). Tautan lain ditolak. */
export function youtubeId(url: string): string | null {
  const match = /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(url.trim())
  return match?.[1] ?? null
}

export function VideoBlock({ url, title, thumbnail, style, frame, puck }: BlockProps<VideoProps>) {
  const id = youtubeId(url)
  if (!id) {
    if (!puck.isEditing) return null
    return (
      <div className={elementFrame}>
        <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-muted-foreground/40 bg-muted text-sm text-muted-foreground">
          <VideoIcon aria-hidden="true" className="size-6" />
          Tempel tautan video YouTube di isian.
        </div>
      </div>
    )
  }
  // youtube-nocookie: YouTube tidak memasang cookie pelacak sebelum video diputar.
  const embed = `https://www.youtube-nocookie.com/embed/${id}`
  const label = title || "Video"

  if (style === "inline") {
    return (
      <div className={elementFrame}>
        <DeviceFrame kind={frame}>
          <iframe
            src={embed}
            title={label}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className={cn("aspect-video w-full", frame === "none" || !frame ? "rounded-xl border" : "")}
          />
        </DeviceFrame>
      </div>
    )
  }

  const poster = (
    <span className="group relative block overflow-hidden rounded-xl">
      {thumbnail ? (
        <BlockImage src={thumbnail} alt="" className="aspect-video w-full rounded-none border-0" puck={puck} />
      ) : (
        <Image src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" width={1280} height={720} unoptimized className="aspect-video w-full object-cover" />
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/20">
        <span className="flex size-16 items-center justify-center rounded-full bg-background/80 shadow-lg ring-8 ring-background/30 backdrop-blur transition-transform group-hover:scale-110">
          <PlayIcon aria-hidden="true" className="size-6 translate-x-0.5 fill-current" />
        </span>
      </span>
    </span>
  )

  return (
    <div className={elementFrame}>
      <DeviceFrame kind={frame}>
        {/* Di editor klik memilih blok, jadi videonya tidak dibuka. */}
        {puck.isEditing ? (
          poster
        ) : (
          <Dialog>
            <DialogTrigger aria-label={`Putar video: ${label}`} className="block w-full cursor-pointer rounded-xl text-left">
              {poster}
            </DialogTrigger>
            <DialogContent className="max-w-4xl overflow-hidden p-0 sm:max-w-4xl">
              <DialogTitle className="sr-only">{label}</DialogTitle>
              <iframe
                src={`${embed}?autoplay=1`}
                title={label}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="aspect-video w-full"
              />
            </DialogContent>
          </Dialog>
        )}
      </DeviceFrame>
    </div>
  )
}

// --- Tumpukan avatar ----------------------------------------------------------------------

export type AvatarStackProps = {
  people: { name: string; image: string | null }[]
  more: string
  caption: string
  align: Align
  /** Avatar untuk orang tanpa foto. */
  avatar_style: "notionists" | "initials"
}

/**
 * Avatar ilustrasi bergaya Notion dari DiceBear (gaya "Notionists" oleh
 * Zoish, CC0), satu wajah tetap per nama. Gambarnya diambil dari api.dicebear.com.
 */
export function dicebearAvatar(name: string): string {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(name || "pelanggan")}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`
}

export function AvatarStackBlock({ people, more, caption, align, avatar_style }: BlockProps<AvatarStackProps>) {
  return (
    <div className={cn(elementFrame, "flex flex-wrap items-center gap-3", justify[align])}>
      <div className="flex -space-x-2 *:data-[slot=avatar]:bg-background">
        {people.map((person, index) => (
          <Avatar key={index} size="lg" className="ring-2 ring-background">
            {person.image ? (
              <AvatarImage src={person.image} alt={person.name} />
            ) : (avatar_style ?? "notionists") === "notionists" ? (
              <AvatarImage src={dicebearAvatar(person.name)} alt={person.name} />
            ) : null}
            <AvatarFallback>{initials(person.name)}</AvatarFallback>
          </Avatar>
        ))}
        {more ? (
          <span className="relative flex size-10 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-2 ring-background">
            {more}
          </span>
        ) : null}
      </div>
      {caption ? <p className="text-sm text-pretty text-muted-foreground">{caption}</p> : null}
    </div>
  )
}

// --- Ikon mengorbit -----------------------------------------------------------------------

export type OrbitProps = {
  center: string
  /** #rrggbb; kosong = warna utama. */
  center_color: string
  /** Warna ikon: #rrggbb; kosong = bergaris. */
  items: { icon: string; color: string }[]
  shape: "rounded" | "circle"
  speed: "slow" | "normal" | "fast"
}

const hex = /^#[0-9a-f]{6}$/i

/** Ubin ikon orbit: bergaris, atau berwarna penuh dengan ikon yang kontras. */
function OrbitTile({ icon, color, size, shape, solid }: { icon: string; color: string; size: "lg" | "xl"; shape: OrbitProps["shape"]; solid?: boolean }) {
  const custom = hex.test(color ?? "")
  return (
    <IconTile
      size={size}
      variant={custom || solid ? "solid" : "outline"}
      aria-hidden="true"
      className={cn(!custom && !solid && "bg-background", shape === "circle" && "[--icon-tile-radius:9999px]")}
      style={custom ? { backgroundColor: color, color: textOn(color) } : undefined}
    >
      <SiteIcon name={icon} />
    </IconTile>
  )
}

export function OrbitBlock({ center, center_color, items, shape, speed }: BlockProps<OrbitProps>) {
  // Separuh ikon di lingkar dalam, sisanya di lingkar luar yang berputar berlawanan.
  const inner = items.slice(0, Math.ceil(items.length / 2))
  const outer = items.slice(inner.length)
  const seconds = { slow: 40, normal: 26, fast: 14 }[speed] ?? 26
  const ring = (list: OrbitProps["items"], radius: number, reverse: boolean) =>
    list.map((item, index) => (
      <span
        key={`${radius}-${index}`}
        className={cn("page-orbit-item", reverse && "page-orbit-reverse")}
        style={
          {
            "--size": "2.75rem",
            "--radius": `${radius}px`,
            "--angle": `${(360 / list.length) * index}deg`,
            "--duration": `${reverse ? seconds * 1.5 : seconds}s`,
          } as CSSProperties
        }
      >
        <OrbitTile icon={item.icon} color={item.color} size="lg" shape={shape} />
      </span>
    ))

  return (
    <div className={elementFrame}>
      <div className="relative mx-auto aspect-square w-full max-w-88 overflow-hidden">
        <span aria-hidden="true" className="absolute top-1/2 left-1/2 size-[180px] -translate-1/2 rounded-full border" />
        {outer.length > 0 ? <span aria-hidden="true" className="absolute top-1/2 left-1/2 size-[300px] -translate-1/2 rounded-full border" /> : null}
        <span className="absolute top-1/2 left-1/2 -translate-1/2">
          <OrbitTile icon={center} color={center_color} size="xl" shape={shape} solid />
        </span>
        {ring(inner, 90, false)}
        {ring(outer, 150, true)}
      </div>
    </div>
  )
}

// --- Teks berjalan ------------------------------------------------------------------------

export type TextMarqueeProps = {
  text: string
  size: "medium" | "large"
  /** Ukuran huruf kustom, piksel; 0 = mengikuti Ukuran. */
  font_size: number
  /** Ikon di antara kata; kosong = tanpa pemisah. */
  separator: string
  /** #rrggbb; kosong = warna aksen. */
  separator_color: string
  /** #rrggbb; kosong = warna teks bagian. */
  color: string
  speed: "slow" | "normal" | "fast"
  reverse: "yes" | "no"
}

export function TextMarqueeBlock({ text, size, font_size, separator, separator_color, color, speed, reverse }: BlockProps<TextMarqueeProps>) {
  const words = text
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean)
  if (words.length === 0) return null
  const perWord = { slow: 8, normal: 5, fast: 3 }[speed] ?? 5
  return (
    <div className={cn(elementFrame, "px-0")}>
      <Marquee seconds={Math.max(words.length * perWord, 12)} reverse={reverse === "yes"} className="[--gap:2rem]">
        {words.map((word, index) => (
          <span
            key={index}
            className={cn(
              "flex shrink-0 items-center gap-8 leading-tight font-semibold tracking-tight whitespace-nowrap",
              font_size > 0 ? "" : size === "large" ? "text-4xl sm:text-6xl" : "text-2xl sm:text-3xl"
            )}
            style={{ ...(font_size > 0 ? { fontSize: `min(${font_size}px, 14vw)` } : {}), ...(hex.test(color ?? "") ? { color } : {}) }}
          >
            {word}
            {separator ? (
              <span className="flex text-(--page-accent)" style={hex.test(separator_color ?? "") ? { color: separator_color } : undefined}>
                <PageIcon name={separator} className="size-[0.6em]" />
              </span>
            ) : null}
          </span>
        ))}
      </Marquee>
    </div>
  )
}

// --- Notifikasi berjalan -----------------------------------------------------------------

export type AnimatedListProps = { items: { icon: string; title: string; description: string; time: string }[]; visible: "3" | "4" | "5" }

/** Butir baru muncul di atas setiap beberapa detik, berputar terus (Animated List). */
export function AnimatedListBlock({ items, visible }: BlockProps<AnimatedListProps>) {
  const shown = Number(visible) || 4
  const total = items.length
  // Pengunjung yang meminta gerak dikurangi langsung melihat daftar penuh, diam.
  const [count, setCount] = useState(() => (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? shown : 1))
  useEffect(() => {
    if (total === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const timer = window.setInterval(() => setCount((current) => current + 1), 2200)
    return () => window.clearInterval(timer)
  }, [total])

  if (total === 0) return null
  // Urutan tak berujung: butir ke-k adalah items[k % total]; yang terbaru di atas.
  const sequence = Array.from({ length: Math.min(count, shown) }, (_, offset) => count - 1 - offset)
  return (
    <div className={elementFrame}>
      <ul className="mx-auto flex w-full max-w-md flex-col gap-3" style={{ minHeight: `${shown * 4.75}rem` }}>
        {sequence.map((position) => {
          const item = items[position % total]
          if (!item) return null
          return (
            <li key={position} className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-xs animate-in duration-500 fade-in slide-in-from-top-4">
              <IconTile aria-hidden="true">
                <SiteIcon name={item.icon} />
              </IconTile>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="truncate">{item.title}</span>
                  {item.time ? <span className="shrink-0 text-xs font-normal text-muted-foreground">· {item.time}</span> : null}
                </p>
                {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
