"use client"

import "./effects.css"

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react"
import { cn } from "cn"

// Efek gerak blok halaman (lihat effects.css), meniru pola Magic UI tanpa
// pustaka animasi. Semua efek berhenti bagi pengunjung yang meminta gerak
// dikurangi.

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

// --- Latar ---------------------------------------------------------------------------

export type BackdropKind = "none" | "glow" | "grid" | "dots" | "stripes" | "aurora" | "retro" | "ripple" | "meteors" | "rays" | "flicker"

const ripples = Array.from({ length: 7 }, (_, index) => index)
/** Letak meteor: tetap, bukan acak, supaya render murni dan sama di setiap kunjungan. */
const meteors = Array.from({ length: 14 }, (_, index) => ({
  left: `${(index * 37 + 11) % 100}%`,
  delay: `${((index * 7) % 10) * 0.6}s`,
  duration: `${4 + (index % 5)}s`,
}))

/**
 * Latar dekoratif di belakang isi. Induknya wajib `relative isolate`. Warna
 * pola bawaan mengikuti warna teks bagian; `color` menggantinya.
 */
export function Backdrop({ kind, color, opacity }: { kind: BackdropKind | undefined; color?: string; opacity?: number }) {
  if (!kind || kind === "none") return null
  const style = {
    ...(color ? { "--page-ink": color, "--page-glow": color } : {}),
    ...(opacity !== undefined && opacity < 1 ? { opacity } : {}),
  } as CSSProperties
  if (kind === "flicker") {
    return (
      <div aria-hidden="true" className="page-bg page-bg-flicker" style={style}>
        <FlickerCanvas />
      </div>
    )
  }
  return (
    <div aria-hidden="true" className={cn("page-bg", `page-bg-${kind}`)} style={style}>
      {kind === "ripple"
        ? ripples.map((index) => (
            <span key={index} style={{ width: 210 + index * 80, height: 210 + index * 80, opacity: 0.9 - index * 0.11, animationDelay: `${index * 0.06}s` }} />
          ))
        : null}
      {kind === "meteors"
        ? meteors.map((meteor, index) => <span key={index} style={{ left: meteor.left, animationDelay: meteor.delay, animationDuration: meteor.duration }} />)
        : null}
    </div>
  )
}

/** Kisi kotak kecil yang berkedip acak (Flickering Grid), digambar di kanvas. */
function FlickerCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return
    const cell = 4
    const step = 10
    let columns = 0
    let alphas = new Float32Array(0)
    let frame = 0
    let last = 0
    let visible = true

    const draw = () => {
      const { width, height } = canvas
      context.clearRect(0, 0, width, height)
      // Warna dari CSS (.page-bg-flicker), jadi ikut tema dan latar bagian.
      context.fillStyle = getComputedStyle(canvas).color
      alphas.forEach((alpha, index) => {
        context.globalAlpha = alpha
        context.fillRect((index % columns) * step, Math.floor(index / columns) * step, cell, cell)
      })
      context.globalAlpha = 1
    }
    const resize = () => {
      const ratio = window.devicePixelRatio || 1
      const box = canvas.getBoundingClientRect()
      canvas.width = Math.ceil(box.width * ratio)
      canvas.height = Math.ceil(box.height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      columns = Math.ceil(box.width / step)
      const rows = Math.ceil(box.height / step)
      alphas = Float32Array.from({ length: columns * rows }, () => Math.random() * 0.3)
      draw()
    }
    const tick = (time: number) => {
      // Sekitar 12 kali per detik cukup untuk berkedip, dan hemat baterai.
      if (visible && time - last > 80) {
        alphas = alphas.map((alpha) => (Math.random() < 0.03 ? Math.random() * 0.3 : alpha))
        draw()
        last = time
      }
      frame = requestAnimationFrame(tick)
    }

    const sizes = new ResizeObserver(resize)
    sizes.observe(canvas)
    const seen = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting)
    })
    seen.observe(canvas)
    if (!reducedMotion()) frame = requestAnimationFrame(tick)
    return () => {
      sizes.disconnect()
      seen.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])
  return <canvas ref={ref} className="size-full" />
}

/**
 * Isi yang bergerak terus ke samping (atau ke atas). Isinya digandakan supaya
 * putarannya mulus; salinannya `inert`, jadi tidak dibaca dua kali.
 */
export function Marquee({
  children,
  reverse = false,
  vertical = false,
  seconds,
  className,
}: {
  children: ReactNode
  reverse?: boolean
  vertical?: boolean
  /** Lama satu putaran. */
  seconds: number
  className?: string
}) {
  return (
    <div
      className={cn("page-marquee", vertical && "page-marquee-vertical", reverse && "page-marquee-reverse", className)}
      style={{ "--duration": `${seconds}s` } as CSSProperties}
    >
      <div className="page-marquee-track">{children}</div>
      <div className="page-marquee-track" inert>
        {children}
      </div>
    </div>
  )
}

// --- Teks ------------------------------------------------------------------------------

export type TextEffect = "accent" | "gradient" | "shine" | "aurora" | "rotate" | "typing"

function wordsOf(text: string): string[] {
  return text
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean)
}

/** Kata yang disorot di judul. "rotate" dan "typing": beberapa kata (dipisah koma) bergantian. */
export function HighlightText({ text, effect }: { text: string; effect: TextEffect }) {
  if (effect === "rotate") return <RotatingWords words={wordsOf(text)} />
  if (effect === "typing") return <TypingWords words={wordsOf(text)} />
  const style = { accent: "text-(--page-accent)", gradient: "page-text-gradient", shine: "page-text-shine", aurora: "page-text-aurora" }[effect]
  return <span className={style ?? "text-(--page-accent)"}>{text}</span>
}

function RotatingWords({ words }: { words: string[] }) {
  const [index, setIndex] = useState(0)
  const count = words.length
  useEffect(() => {
    if (count < 2 || reducedMotion()) return
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), 2600)
    return () => window.clearInterval(timer)
  }, [count])

  // Semua kata ditumpuk di sel yang sama: lebarnya selebar kata terpanjang,
  // jadi judul tidak bergeser setiap kali katanya berganti. Kata yang tampil
  // di tengah sel, karena blok yang memakainya berteks rata tengah.
  return (
    <span className="inline-grid justify-items-center text-(--page-accent)">
      <span className="sr-only">{words.join(", ")}</span>
      {words.map((word, position) => (
        <span
          key={position}
          aria-hidden="true"
          className={cn(
            "col-start-1 row-start-1 transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none",
            position === index % Math.max(count, 1) ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          )}
        >
          {word}
        </span>
      ))}
    </span>
  )
}

/**
 * Kata diketik huruf demi huruf, dihapus, lalu kata berikutnya (Typing
 * Animation). Teksnya diubah langsung di simpul teks yang dirender React,
 * supaya tidak merender ulang setiap huruf.
 */
function TypingWords({ words }: { words: string[] }) {
  const ref = useRef<HTMLSpanElement>(null)
  const key = words.join("\n")
  useEffect(() => {
    const node = ref.current?.firstChild
    const list = key.split("\n").filter(Boolean)
    if (!node || list.length === 0 || reducedMotion()) return
    let word = 0
    let chars = 0
    let deleting = false
    let timer = 0
    const step = () => {
      const current = list[word] ?? ""
      chars += deleting ? -1 : 1
      node.nodeValue = current.slice(0, chars) || "​"
      let delay = deleting ? 45 : 85
      if (!deleting && chars >= current.length) {
        if (list.length === 1) return
        deleting = true
        delay = 1700
      } else if (deleting && chars <= 0) {
        deleting = false
        word = (word + 1) % list.length
        delay = 350
      }
      timer = window.setTimeout(step, delay)
    }
    node.nodeValue = "​"
    timer = window.setTimeout(step, 500)
    return () => {
      window.clearTimeout(timer)
      node.nodeValue = list[0] ?? ""
    }
  }, [key])

  return (
    <span className="text-(--page-accent)">
      <span className="sr-only">{words.join(", ")}</span>
      <span ref={ref} aria-hidden="true" className="page-caret">
        {words[0] ?? ""}
      </span>
    </span>
  )
}

// --- Tombol dan kartu ------------------------------------------------------------------

export type ButtonEffect = "none" | "shine" | "shimmer" | "rainbow" | "pulse"

export const buttonEffectClass: Record<ButtonEffect, string> = {
  none: "",
  shine: "page-btn-shine",
  shimmer: "page-btn-shimmer",
  rainbow: "page-btn-rainbow",
  pulse: "page-btn-pulse",
}

export type CardEffect = "none" | "beam" | "shine" | "neon" | "spotlight"

const cardEffectClass: Record<CardEffect, string> = {
  none: "",
  beam: "page-fx-beam",
  shine: "page-fx-shine",
  neon: "page-fx-neon",
  spotlight: "page-fx-spotlight",
}

function followPointer(event: PointerEvent<HTMLDivElement>) {
  const box = event.currentTarget.getBoundingClientRect()
  event.currentTarget.style.setProperty("--page-x", `${event.clientX - box.left}px`)
  event.currentTarget.style.setProperty("--page-y", `${event.clientY - box.top}px`)
}

/**
 * Pembungkus kartu berefek: Border Beam, Shine Border, Neon, atau sorot yang
 * mengikuti kursor (Magic Card). Sudutnya harus sama dengan kartunya
 * (`className`), karena efeknya digambar di tepi pembungkus.
 */
export function EffectFrame({ effect, className, children }: { effect: CardEffect | undefined; className?: string; children: ReactNode }) {
  if (!effect || effect === "none") return <>{children}</>
  return (
    <div className={cn(cardEffectClass[effect], className)} onPointerMove={effect === "spotlight" ? followPointer : undefined}>
      {children}
    </div>
  )
}

// --- Bingkai perangkat -----------------------------------------------------------------

export type DeviceKind = "none" | "browser" | "phone"

/** Bingkai jendela peramban atau ponsel di sekeliling gambar (Safari, iPhone Magic UI). */
export function DeviceFrame({ kind, children }: { kind: DeviceKind | undefined; children: ReactNode }) {
  if (kind === "browser") {
    return (
      <div className="overflow-hidden rounded-xl border bg-card shadow-xl">
        <div aria-hidden="true" className="flex items-center gap-1.5 border-b bg-muted px-3 py-2">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="mx-auto h-4 w-2/5 rounded-md bg-background" />
        </div>
        {children}
      </div>
    )
  }
  if (kind === "phone") {
    return (
      <div className="relative mx-auto w-full max-w-68 rounded-[2.6rem] border-[9px] border-invert bg-invert shadow-xl">
        <span aria-hidden="true" className="absolute top-1.5 left-1/2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-invert" />
        <div className="overflow-hidden rounded-[2rem]">{children}</div>
      </div>
    )
  }
  return <>{children}</>
}
