"use client"

import Image from "next/image"
import { createContext, use, type CSSProperties, type ReactNode } from "react"
import type { PuckContext } from "@puckeditor/core"
import { cn } from "cn"

import { Backdrop, type BackdropKind } from "./effects"
import { Animate, type MotionType } from "./motion"

// Pengaturan tampilan yang sama untuk setiap bagian halaman: ukuran (lebar,
// tinggi, jarak), latar (warna, gradien, gambar), pola, id untuk tautan, dan
// di layar mana ia tampil. Datanya `appearance` di props blok; blok lama tanpa
// `appearance`, atau tanpa sebagian isinya, tampil dengan nilai bawaan.

export type Appearance = {
  width: "default" | "narrow" | "normal" | "wide" | "full"
  height: "auto" | "large" | "screen" | "custom"
  /** Tinggi "custom", persen tinggi layar. */
  heightVh: number
  /** Letak isi bila bagian lebih tinggi dari isinya. */
  valign: "top" | "center" | "bottom"
  spacing: "default" | "none" | "small" | "medium" | "large" | "custom"
  /** Jarak "custom", piksel. */
  spaceTop: number
  spaceBottom: number
  background: "none" | "muted" | "card" | "primary" | "inverse" | "color" | "gradient" | "image"
  /** Warna "color", dan warna awal "gradient": #rrggbb. */
  color: string
  /** Warna akhir "gradient". */
  color2: string
  direction: "down" | "right" | "diagonal" | "radial"
  /** Warna dan gradien pilihan sendiri digelapkan saat pengunjung memakai mode gelap. */
  adapt: boolean
  image: string | null
  /** Bagian gambar yang dijaga tetap terlihat saat gambar dipotong. */
  focus: "center" | "top" | "bottom" | "left" | "right"
  overlay: "dark" | "light" | "none"
  strength: "soft" | "medium" | "strong"
  pattern: BackdropKind
  /** Warna pola, #rrggbb; kosong = mengikuti warna teks bagian. */
  patternColor: string
  /** Kekuatan pola, 10–100 (persen). */
  patternOpacity: number
  /** Ukuran judul bagian dan teks pengantarnya, piksel; 0 = bawaan blok. */
  titleSize: number
  textSize: number
  /** Animasi saat bagian terlihat (motion), dengan lama, jeda, dan pengulangannya. */
  reveal: MotionType
  revealDuration: number
  revealDelay: number
  revealRepeat: "once" | "always"
  anchor: string
  visibility: "all" | "desktop" | "mobile"
}

export const defaultAppearance: Appearance = {
  width: "default",
  height: "auto",
  heightVh: 60,
  valign: "center",
  spacing: "default",
  spaceTop: 64,
  spaceBottom: 64,
  background: "none",
  color: "#f4efe6",
  color2: "#dcebfb",
  direction: "diagonal",
  adapt: true,
  image: null,
  focus: "center",
  overlay: "dark",
  strength: "medium",
  pattern: "none",
  patternColor: "",
  patternOpacity: 100,
  titleSize: 0,
  textSize: 0,
  reveal: "none",
  revealDuration: 700,
  revealDelay: 0,
  revealRepeat: "once",
  anchor: "",
  visibility: "all",
}

export function appearanceOf(value: Partial<Appearance> | undefined): Appearance {
  return { ...defaultAppearance, ...value }
}

/** id yang aman dari isian bebas: huruf kecil, angka, dan tanda hubung. */
export function anchorOf(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// --- Lebar dan jarak: dibaca `Section` di blocks.tsx --------------------------------

type Layout = Pick<Appearance, "width" | "spacing" | "spaceTop" | "spaceBottom">

const LayoutContext = createContext<Layout>({ width: "default", spacing: "default", spaceTop: 0, spaceBottom: 0 })

const widthClass: Record<Appearance["width"], string> = {
  default: "",
  narrow: "max-w-3xl",
  normal: "max-w-6xl",
  wide: "max-w-[90rem]",
  full: "max-w-none",
}

const spacingClass: Record<Appearance["spacing"], string> = {
  default: "",
  none: "py-0 lg:py-0",
  small: "py-6 lg:py-8",
  medium: "py-10 lg:py-14",
  large: "py-16 lg:py-24",
  custom: "",
}

/**
 * Lebar dan jarak pilihan pengelola untuk `Section`: kelasnya ditaruh
 * terakhir supaya menang atas bawaan blok; jarak kustom lewat gaya langsung.
 */
export function useSectionLayout(): { className: string; style?: CSSProperties } {
  const { width, spacing, spaceTop, spaceBottom } = use(LayoutContext)
  return {
    className: cn(widthClass[width], spacingClass[spacing]),
    style: spacing === "custom" ? { paddingTop: spaceTop, paddingBottom: spaceBottom } : undefined,
  }
}

// --- Warna -------------------------------------------------------------------------

const darkText = "oklch(0.18 0 0)"
const lightText = "oklch(0.985 0 0)"
/** Dasar penggelap warna untuk mode gelap: sama gelapnya dengan latar aplikasi. */
const night = "oklch(0.17 0 0)"
const hexColor = /^#[0-9a-f]{6}$/i

function luminance(hex: string): number {
  const [red = 0, green = 0, blue = 0] = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/**
 * Teks hitam atau putih: mana yang kontras terendahnya paling tinggi di atas
 * semua warna ini (WCAG). Untuk gradien, keduanya harus terbaca.
 */
export function textOn(...hexes: string[]): string {
  const levels = hexes.map(luminance)
  const onBlack = Math.min(...levels.map((level) => (level + 0.05) / 0.05))
  const onWhite = Math.min(...levels.map((level) => 1.05 / (level + 0.05)))
  return onBlack >= onWhite ? darkText : lightText
}

/** Versi mode gelap warna terang: warnanya tetap terasa, tapi segelap latar aplikasi. */
function nightOf(hex: string): string {
  return textOn(hex) === darkText ? `color-mix(in oklch, ${hex} 22%, ${night})` : hex
}

function gradientOf(direction: Appearance["direction"], from: string, to: string): string {
  if (direction === "radial") return `radial-gradient(circle at 50% 0%, ${from}, ${to} 75%)`
  const angle = { down: "180deg", right: "90deg", diagonal: "135deg" }[direction]
  return `linear-gradient(${angle}, ${from}, ${to})`
}

/** Satu set warna latar: [warna latar, warna teks, gambar latar (gradien)]. */
type Scheme = { bg: string; fg: string; image?: string }

/**
 * Warna latar dan teks bagian. Latar bawaan cukup kelas token (ikut tema).
 * Latar berwarna memberi `--surface-*` di pembungkus luar; pembungkus dalam
 * memetakan ulang token aplikasi darinya (lihat `remapped`). Warna pilihan
 * sendiri bisa punya versi mode gelap (`.page-surface-adaptive`, effects.css).
 */
function surfaceOf(look: Appearance): { className?: string; style?: CSSProperties } {
  const plain = (scheme: Scheme): CSSProperties =>
    ({ "--surface-bg": scheme.bg, "--surface-fg": scheme.fg, ...(scheme.image ? { "--surface-image": scheme.image } : {}) }) as CSSProperties
  const adaptive = (day: Scheme, dark: Scheme) => ({
    className: "page-surface-adaptive",
    style: {
      "--surface-day-bg": day.bg,
      "--surface-day-fg": day.fg,
      "--surface-day-image": day.image ?? "none",
      "--surface-night-bg": dark.bg,
      "--surface-night-fg": dark.fg,
      "--surface-night-image": dark.image ?? "none",
    } as CSSProperties,
  })

  switch (look.background) {
    case "muted":
      return { className: "bg-muted" }
    case "card":
      return { className: "bg-card" }
    case "primary":
      return { style: plain({ bg: "var(--primary)", fg: "var(--primary-foreground)" }) }
    case "inverse":
      return { style: plain({ bg: "var(--invert)", fg: "var(--invert-foreground)" }) }
    case "color": {
      if (!hexColor.test(look.color)) return {}
      const day = { bg: look.color, fg: textOn(look.color) }
      if (!look.adapt) return { style: plain(day) }
      const dark = nightOf(look.color)
      return adaptive(day, { bg: dark, fg: dark === look.color ? day.fg : lightText })
    }
    case "gradient": {
      if (!hexColor.test(look.color) || !hexColor.test(look.color2)) return {}
      const day = {
        bg: `color-mix(in oklch, ${look.color} 50%, ${look.color2})`,
        fg: textOn(look.color, look.color2),
        image: gradientOf(look.direction, look.color, look.color2),
      }
      if (!look.adapt) return { style: plain(day) }
      const [from, to] = [nightOf(look.color), nightOf(look.color2)]
      const changed = from !== look.color || to !== look.color2
      return adaptive(day, {
        bg: `color-mix(in oklch, ${from} 50%, ${to})`,
        fg: changed ? lightText : day.fg,
        image: gradientOf(look.direction, from, to),
      })
    }
    case "image":
      if (!look.image) return {}
      return { style: plain(look.overlay === "light" ? { bg: "oklch(0.97 0 0)", fg: darkText } : { bg: "oklch(0.2 0 0)", fg: lightText }) }
    default:
      return {}
  }
}

const remapped = {
  "--background": "var(--surface-bg)",
  "--foreground": "var(--surface-fg)",
  "--card": "color-mix(in oklch, var(--surface-fg) 7%, var(--surface-bg))",
  "--card-foreground": "var(--surface-fg)",
  "--popover": "color-mix(in oklch, var(--surface-fg) 7%, var(--surface-bg))",
  "--popover-foreground": "var(--surface-fg)",
  "--muted": "color-mix(in oklch, var(--surface-fg) 10%, var(--surface-bg))",
  "--muted-foreground": "color-mix(in oklch, var(--surface-fg) 72%, var(--surface-bg))",
  "--secondary": "color-mix(in oklch, var(--surface-fg) 12%, var(--surface-bg))",
  "--secondary-foreground": "var(--surface-fg)",
  "--accent": "color-mix(in oklch, var(--surface-fg) 12%, var(--surface-bg))",
  "--accent-foreground": "var(--surface-fg)",
  "--border": "color-mix(in oklch, var(--surface-fg) 18%, transparent)",
  "--input": "color-mix(in oklch, var(--surface-fg) 22%, transparent)",
  "--ring": "color-mix(in oklch, var(--surface-fg) 45%, transparent)",
  "--primary": "var(--surface-fg)",
  "--primary-foreground": "var(--surface-bg)",
  "--page-accent": "var(--surface-fg)",
} as CSSProperties

/**
 * Wilayah berwarna di luar bagian halaman (navbar, kaki situs): latar token
 * dengan pemetaan ulang yang sama, supaya teks, garis, dan tombol di dalamnya
 * tetap terbaca.
 */
export function ColorScope({
  background,
  className,
  children,
}: {
  background: "default" | "muted" | "primary" | "inverse"
  className?: string
  children: ReactNode
}) {
  const colors =
    background === "primary"
      ? { "--surface-bg": "var(--primary)", "--surface-fg": "var(--primary-foreground)" }
      : background === "inverse"
        ? { "--surface-bg": "var(--invert)", "--surface-fg": "var(--invert-foreground)" }
        : null
  return (
    <div
      className={cn(background === "muted" ? "bg-muted" : background === "default" ? "bg-background" : "", className)}
      style={colors ? ({ ...colors, backgroundColor: "var(--surface-bg)", color: "var(--surface-fg)" } as CSSProperties) : undefined}
    >
      <div style={colors ? remapped : undefined} className="contents">
        {children}
      </div>
    </div>
  )
}

/** Wilayah bergradien dua warna (Ajakan gradien): token dipetakan ulang seperti ColorScope. */
export function GradientScope({ from, to, className, children }: { from: string; to: string; className?: string; children: ReactNode }) {
  const valid = hexColor.test(from) && hexColor.test(to)
  const style = valid
    ? ({
        "--surface-bg": `color-mix(in oklch, ${from} 50%, ${to})`,
        "--surface-fg": textOn(from, to),
        backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
        color: "var(--surface-fg)",
      } as CSSProperties)
    : undefined
  return (
    <div className={cn(!valid && "bg-muted", className)} style={style}>
      <div style={valid ? remapped : undefined} className="contents">
        {children}
      </div>
    </div>
  )
}

/** Latar navbar, kaki situs, dan banner (`ChromeLook` di lib/pages). */
export type ChromeLookStyle = {
  kind: "solid" | "blur" | "gradient"
  tone: "default" | "muted" | "primary" | "inverse" | "custom"
  color: string
  color2: string
  direction: "right" | "down" | "diagonal"
  opacity: number
  adapt: boolean
}

/**
 * Pembungkus berlatar untuk navbar, kaki situs, dan banner: solid, kaca
 * buram, atau gradien; warna tema atau pilihan sendiri. Warna teks dan token
 * di dalamnya mengikuti latarnya, seperti Tampilan bagian.
 */
export function ChromeScope({ look, className, children }: { look: ChromeLookStyle; className?: string; children: ReactNode }) {
  const custom =
    look.kind === "gradient"
      ? surfaceOf({ ...defaultAppearance, background: "gradient", color: look.color, color2: look.color2, direction: look.direction, adapt: look.adapt })
      : look.tone === "custom"
        ? surfaceOf({ ...defaultAppearance, background: "color", color: look.color, adapt: look.adapt })
        : look.tone === "primary" || look.tone === "inverse"
          ? surfaceOf({ ...defaultAppearance, background: look.tone })
          : null
  // Warna tema (polos, abu-abu) tidak perlu dipetakan ulang: tombol utama tetap berwarna utama.
  const surface = custom?.style
    ? custom
    : { style: { "--surface-bg": look.tone === "muted" ? "var(--muted)" : "var(--background)", "--surface-fg": "var(--foreground)" } as CSSProperties }
  const blur = look.kind === "blur"
  return (
    <div
      className={cn(surface.className, className)}
      style={{
        ...surface.style,
        backgroundColor: blur ? `color-mix(in oklch, var(--surface-bg) ${Math.min(Math.max(look.opacity, 30), 100)}%, transparent)` : "var(--surface-bg)",
        ...(look.kind === "gradient" ? { backgroundImage: "var(--surface-image)" } : {}),
        ...(blur ? { backdropFilter: "blur(14px) saturate(1.4)", WebkitBackdropFilter: "blur(14px) saturate(1.4)" } : {}),
        color: "var(--surface-fg)",
      }}
    >
      <div className="contents" style={custom?.style ? remapped : undefined}>
        {children}
      </div>
    </div>
  )
}

const overlayAlpha: Record<Appearance["strength"], { dark: number; light: number }> = {
  soft: { dark: 0.3, light: 0.5 },
  medium: { dark: 0.55, light: 0.72 },
  strong: { dark: 0.78, light: 0.88 },
}

const focusClass: Record<Appearance["focus"], string> = {
  center: "object-center",
  top: "object-top",
  bottom: "object-bottom",
  left: "object-left",
  right: "object-right",
}

const heightClass: Record<Appearance["height"], string> = {
  auto: "",
  large: "flex min-h-[70svh] flex-col",
  screen: "flex min-h-svh flex-col",
  custom: "flex flex-col",
}

const valignClass: Record<Appearance["valign"], string> = {
  top: "justify-start",
  center: "justify-center",
  bottom: "justify-end",
}

const visibilityClass: Record<Appearance["visibility"], string> = {
  all: "",
  desktop: "hidden md:block",
  mobile: "md:hidden",
}

/** Pembungkus setiap bagian halaman: latar, pola, tinggi, id, dan lebar/jarak untuk isinya. */
export function Surface({ appearance, puck, children }: { appearance?: Partial<Appearance>; puck: PuckContext; children: ReactNode }) {
  const look = appearanceOf(appearance)
  const surface = surfaceOf(look)
  const colored = Boolean(surface.style)
  const anchor = anchorOf(look.anchor)
  const tall = look.height !== "auto"
  const alpha = overlayAlpha[look.strength]
  const visibility = visibilityClass[look.visibility]

  return (
    <div
      id={anchor || undefined}
      className={cn(
        // overflow-x-clip: efek latar dan pendar kartu tidak pernah membuat halaman bergulir ke samping.
        "relative isolate scroll-mt-20 overflow-x-clip",
        surface.className,
        heightClass[look.height],
        // Di editor bagian yang disembunyikan tetap tampil, ditandai, supaya bisa disunting.
        puck.isEditing
          ? look.visibility !== "all" && "outline-2 -outline-offset-2 outline-border outline-dashed"
          : look.visibility === "desktop" && tall
            ? "hidden md:flex"
            : visibility
      )}
      style={{
        ...(colored
          ? { ...surface.style, backgroundColor: "var(--surface-bg)", backgroundImage: "var(--surface-image, none)", color: "var(--surface-fg)" }
          : {}),
        ...(look.height === "custom" ? { minHeight: `${look.heightVh}svh` } : {}),
      }}
    >
      {look.background === "image" && look.image ? (
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <Image src={look.image} alt="" fill unoptimized className={cn("object-cover", focusClass[look.focus])} />
          {look.overlay !== "none" ? (
            <div
              className="absolute inset-0"
              style={{ background: look.overlay === "dark" ? `oklch(0 0 0 / ${alpha.dark})` : `oklch(1 0 0 / ${alpha.light})` }}
            />
          ) : null}
        </div>
      ) : null}
      <Backdrop kind={look.pattern} color={hexColor.test(look.patternColor) ? look.patternColor : undefined} opacity={look.patternOpacity / 100} />
      {puck.isEditing && look.visibility !== "all" ? (
        <span className="absolute top-2 left-2 z-10 rounded-md bg-invert px-2 py-0.5 text-xs text-invert-foreground">
          {look.visibility === "mobile" ? "Hanya tampil di ponsel" : "Hanya tampil di komputer"}
        </span>
      ) : null}
      <div
        // Ukuran judul dan teks pengantar kustom: dibaca `.page-title` dan `.page-lead` (effects.css).
        data-title-size={look.titleSize > 0 ? "" : undefined}
        data-text-size={look.textSize > 0 ? "" : undefined}
        style={{
          ...(colored ? remapped : {}),
          ...(look.titleSize > 0 ? { "--page-title-size": `${look.titleSize}px` } : {}),
          ...(look.textSize > 0 ? { "--page-text-size": `${look.textSize}px` } : {}),
        }}
        className={cn(tall && "flex flex-1 flex-col", tall && valignClass[look.valign])}
      >
        <Animate
          settings={{ type: look.reveal, duration: look.revealDuration, delay: look.revealDelay, repeat: look.revealRepeat }}
          preview={puck.isEditing}
          className={cn(tall && "flex flex-1 flex-col", tall && valignClass[look.valign])}
        >
          <LayoutContext value={{ width: look.width, spacing: look.spacing, spaceTop: look.spaceTop, spaceBottom: look.spaceBottom }}>{children}</LayoutContext>
        </Animate>
      </div>
    </div>
  )
}
