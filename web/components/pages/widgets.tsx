"use client"

import { use, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react"
import type { Slot } from "@puckeditor/core"
import { cn } from "cn"

import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader, CodeBlockLanguage, CodeBlockTitle } from "@/components/reui/code-block/code-block"
import { IconStack } from "@/components/reui/icon-stack"
import { Rating } from "@/components/reui/rating"
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/components/reui/timeline"
import { buttonVariants } from "@/components/ui/button"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"

import { BlockImage, elementFrame, resolveLink, stackVars, useOverlayPortal, type BlockProps, type SlotBlockProps } from "./blocks"
import type { Align } from "./elements"
import { motionSettledEvent } from "./motion"
import { PageIcon } from "./page-icon"
import { InCanvasContext } from "./stat-number"

// Komponen tambahan dari ReUI dan shadcn: carousel, daftar isi (scrollspy),
// rating, progres, kode, tumpukan ikon, dialog, tabel, dan linimasa.

const justify: Record<Align, string> = { left: "justify-start", center: "justify-center", right: "justify-end" }
const hex = /^#[0-9a-f]{6}$/i

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

// --- Carousel ---------------------------------------------------------------------------

export type CarouselProps = {
  slides: { image: string | null; title: string; caption: string; link: string }[]
  per_view: "1" | "2" | "3" | "4"
  ratio: "16/9" | "4/3" | "1/1" | "3/4"
  style: "card" | "image"
  controls: "arrows" | "dots" | "both" | "none"
  autoplay: "off" | "3" | "5" | "8"
  loop: "yes" | "no"
}

const perViewClass = { "1": "basis-full", "2": "sm:basis-1/2", "3": "sm:basis-1/2 lg:basis-1/3", "4": "sm:basis-1/2 lg:basis-1/4" }
const ratioClass = { "16/9": "aspect-video", "4/3": "aspect-4/3", "1/1": "aspect-square", "3/4": "aspect-3/4" }

export function CarouselBlock({ slides, per_view, ratio, style, controls, autoplay, loop, puck }: BlockProps<CarouselProps>) {
  const [api, setApi] = useState<CarouselApi>()
  const [selected, setSelected] = useState(0)
  const [count, setCount] = useState(0)
  const portal = useOverlayPortal(puck)

  useEffect(() => {
    if (!api) return
    const sync = () => {
      setSelected(api.selectedScrollSnap())
      setCount(api.scrollSnapList().length)
    }
    sync()
    api.on("select", sync).on("reInit", sync)
    return () => {
      api.off("select", sync).off("reInit", sync)
    }
  }, [api])

  // Diukur ulang sesudah animasi muncul selesai (motionSettledEvent); slide yang tampil tetap.
  useEffect(() => {
    if (!api) return
    let measured = api.rootNode().getBoundingClientRect().width
    const remeasure = () => {
      const width = api.rootNode().getBoundingClientRect().width
      if (Math.abs(width - measured) < 1) return
      measured = width
      api.reInit({ startIndex: api.selectedScrollSnap() })
    }
    window.addEventListener(motionSettledEvent, remeasure)
    return () => window.removeEventListener(motionSettledEvent, remeasure)
  }, [api])

  // Putar otomatis: tidak di editor dan tidak bagi yang meminta gerak dikurangi.
  useEffect(() => {
    if (!api || autoplay === "off" || puck.isEditing || reducedMotion()) return
    const timer = window.setInterval(() => (api.canScrollNext() ? api.scrollNext() : api.scrollTo(0)), Number(autoplay) * 1000)
    return () => window.clearInterval(timer)
  }, [api, autoplay, puck.isEditing])

  if (slides.length === 0) return null
  const arrows = controls === "arrows" || controls === "both"
  const dots = controls === "dots" || controls === "both"
  return (
    <div className={elementFrame}>
      <Carousel setApi={setApi} opts={{ loop: loop === "yes", align: "start" }} className="relative">
        <CarouselContent>
          {slides.map((slide, index) => {
            const target = resolveLink(slide.link, puck)
            const body = (
              <figure className={cn("flex h-full flex-col overflow-hidden", style === "card" && "rounded-xl border bg-card shadow-xs")}>
                <div className="relative">
                  <BlockImage
                    src={slide.image}
                    alt={slide.title}
                    className={cn(ratioClass[ratio] ?? "aspect-video", "w-full", style === "card" && "rounded-none border-0")}
                    puck={puck}
                  />
                  {style === "image" && (slide.title || slide.caption) ? (
                    <figcaption className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 rounded-b-xl bg-linear-to-t from-black/70 to-transparent p-4 text-white">
                      {slide.title ? <span className="font-semibold">{slide.title}</span> : null}
                      {slide.caption ? <span className="text-sm opacity-90">{slide.caption}</span> : null}
                    </figcaption>
                  ) : null}
                </div>
                {style === "card" && (slide.title || slide.caption) ? (
                  // mt-auto: judul kartu tanpa gambar sejajar dengan kartu di sebelahnya.
                  <figcaption className="mt-auto flex flex-col gap-1 p-4">
                    {slide.title ? <span className="font-semibold">{slide.title}</span> : null}
                    {slide.caption ? <span className="text-sm text-pretty text-muted-foreground">{slide.caption}</span> : null}
                  </figcaption>
                ) : null}
              </figure>
            )
            return (
              <CarouselItem key={index} className={perViewClass[per_view] ?? "basis-full"}>
                {target ? (
                  <a href={puck.isEditing ? undefined : target} className="block h-full">
                    {body}
                  </a>
                ) : (
                  body
                )}
              </CarouselItem>
            )
          })}
        </CarouselContent>
        {arrows ? (
          <>
            {/* Panah bisa diklik langsung di editor (overlay portal). */}
            <CarouselPrevious ref={portal} className="left-3 bg-background/80 backdrop-blur" />
            <CarouselNext ref={portal} className="right-3 bg-background/80 backdrop-blur" />
          </>
        ) : null}
      </Carousel>
      {dots && count > 1 ? (
        <div className="mt-4 flex justify-center gap-1.5">
          {Array.from({ length: count }, (_, index) => (
            <button
              key={index}
              ref={portal}
              type="button"
              aria-label={`Slide ${index + 1}`}
              aria-current={index === selected}
              onClick={() => api?.scrollTo(index)}
              className={cn("h-2 rounded-full bg-muted-foreground/30 transition-all", index === selected ? "w-6 bg-primary" : "w-2")}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

// --- Daftar isi (scrollspy) -------------------------------------------------------------------

export type ScrollspyProps = {
  title: string
  items: { label: string; target: string }[]
  style: "list" | "pills" | "line"
  orientation: "vertical" | "horizontal"
}

// Jarak dari atas layar saat menggulir ke bagian tujuan: ruang untuk navbar yang menempel.
const spyOffset = 96

/**
 * Bagian yang sedang dibaca: bagian terakhir yang bagian atasnya sudah lewat
 * garis `spyOffset`. Posisi diukur dengan getBoundingClientRect, bukan
 * offsetTop, karena bagian halaman bersarang di dalam pembungkus ber-posisi.
 */
function useActiveSection(targets: string[], enabled: boolean): string | null {
  const [active, setActive] = useState<string | null>(null)
  const key = targets.join("|")
  useEffect(() => {
    if (!enabled) return
    const ids = key ? key.split("|") : []
    let frame = 0
    const measure = () => {
      frame = 0
      let current: string | null = null
      for (const id of ids) {
        const element = document.getElementById(id)
        if (element && element.getBoundingClientRect().top <= spyOffset + 8) current = id
      }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      setActive(atBottom ? (ids.findLast((id) => document.getElementById(id)) ?? current) : (current ?? ids[0] ?? null))
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure)
    }
    schedule()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
  }, [key, enabled])
  return active
}

function scrollToSection(event: MouseEvent<HTMLAnchorElement>, id: string) {
  const element = document.getElementById(id)
  if (!element) return
  event.preventDefault()
  const top = element.getBoundingClientRect().top + window.scrollY - spyOffset
  window.scrollTo({ top, behavior: reducedMotion() ? "auto" : "smooth" })
}

export function ScrollspyBlock({ title, items, style, orientation }: BlockProps<ScrollspyProps>) {
  // Di kanvas editor (iframe) daftarnya statis: jendela dan dokumennya milik editor.
  const inCanvas = use(InCanvasContext)
  const entries = items
    .filter((item) => item.label.trim() && item.target.trim())
    .map((item) => ({ label: item.label, target: item.target.trim().replace(/^#/, "") }))
  const active = useActiveSection(
    entries.map((entry) => entry.target),
    !inCanvas
  )
  const vertical = orientation === "vertical"
  const links = entries.map(({ label, target }) => {
    return (
      <a
        key={target}
        href={`#${target}`}
        aria-current={active === target ? "location" : undefined}
        data-active={active === target}
        onClick={inCanvas ? undefined : (event) => scrollToSection(event, target)}
        className={cn(
          "text-sm text-muted-foreground transition-colors hover:text-foreground data-[active=true]:font-medium data-[active=true]:text-foreground",
          style === "pills" && "rounded-full px-3 py-1.5 data-[active=true]:bg-muted",
          style === "list" && "rounded-md px-3 py-1.5 data-[active=true]:bg-muted",
          style === "line" &&
            (vertical
              ? "-ml-px border-l-2 border-transparent py-1 pl-3 data-[active=true]:border-primary"
              : "-mb-px border-b-2 border-transparent px-1 pb-2 data-[active=true]:border-primary")
        )}
      >
        {label}
      </a>
    )
  })
  return (
    <div className={cn(elementFrame, "flex flex-col gap-3")}>
      {title ? <p className="text-sm font-semibold">{title}</p> : null}
      <nav
        aria-label={title || "Daftar isi"}
        className={cn("flex gap-1", vertical ? "flex-col" : "flex-wrap items-center", style === "line" && (vertical ? "border-l" : "gap-5 border-b"))}
      >
        {links}
      </nav>
    </div>
  )
}

// --- Rating -----------------------------------------------------------------------------------

export type RatingProps = { rating: number; max: number; size: "sm" | "default" | "lg"; show_value: "yes" | "no"; caption: string; color: string; align: Align }

export function RatingBlock({ rating, max, size, show_value, caption, color, align }: BlockProps<RatingProps>) {
  return (
    <div className={cn(elementFrame, "flex flex-wrap items-center gap-3", justify[align])}>
      <Rating
        rating={Math.min(Math.max(rating, 0), max || 5)}
        maxRating={max || 5}
        size={size}
        showValue={show_value === "yes"}
        aria-label={`Nilai ${rating} dari ${max || 5}`}
        className={hex.test(color ?? "") ? "**:data-[slot=rating-star-filled]:fill-(--star) **:data-[slot=rating-star-filled]:text-(--star)" : undefined}
        style={hex.test(color ?? "") ? ({ "--star": color } as CSSProperties) : undefined}
      />
      {caption ? <span className="text-sm text-muted-foreground">{caption}</span> : null}
    </div>
  )
}

// --- Progres ----------------------------------------------------------------------------------

export type ProgressProps = {
  items: { label: string; value: number }[]
  size: "thin" | "medium" | "thick"
  show_value: "yes" | "no"
  color: string
  animate: "yes" | "no"
}

const trackClass = { thin: "**:data-[slot=progress-track]:h-1", medium: "**:data-[slot=progress-track]:h-2", thick: "**:data-[slot=progress-track]:h-3.5" }

export function ProgressBlock({ items, size, show_value, color, animate }: BlockProps<ProgressProps>) {
  const ref = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (animate !== "yes" || !element) return
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      setSeen(true)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [animate])
  return (
    <div ref={ref} className={cn(elementFrame, "flex flex-col gap-4")} style={hex.test(color ?? "") ? ({ "--bar": color } as CSSProperties) : undefined}>
      {items.map((item, index) => {
        const value = Math.min(Math.max(item.value, 0), 100)
        return (
          <Progress
            key={index}
            value={animate === "yes" && !seen ? 0 : value}
            aria-label={item.label}
            className={cn(
              "gap-2",
              trackClass[size] ?? trackClass.medium,
              "**:data-[slot=progress-indicator]:transition-[width] **:data-[slot=progress-indicator]:duration-1000 **:data-[slot=progress-indicator]:ease-out",
              hex.test(color ?? "") && "**:data-[slot=progress-indicator]:bg-(--bar)"
            )}
          >
            <span className="text-sm font-medium">{item.label}</span>
            {show_value === "yes" ? <span className="ml-auto text-sm text-muted-foreground tabular-nums">{value}%</span> : null}
          </Progress>
        )
      })}
    </div>
  )
}

// --- Kode -------------------------------------------------------------------------------------

export type CodeProps = { title: string; code: string; language: string; line_numbers: "yes" | "no" }

export function CodeBlockBlock({ title, code, language, line_numbers }: BlockProps<CodeProps>) {
  return (
    <div className={elementFrame}>
      <CodeBlock code={code} language={language || "text"} highlight={language !== "text"} showLineNumbers={line_numbers === "yes"}>
        <CodeBlockHeader>
          {title ? <CodeBlockTitle>{title}</CodeBlockTitle> : <CodeBlockLanguage />}
          <CodeBlockCopyButton className="ml-auto" labels={{ copy: "Salin", copied: "Tersalin" }} />
        </CodeBlockHeader>
      </CodeBlock>
    </div>
  )
}

// --- Tumpukan ikon ------------------------------------------------------------------------------

export type IconStackProps = { icon: string; caption: string; size: "sm" | "md" | "lg"; color: string; align: Align }

const stackSize = { sm: "h-14 w-12 [&_svg.lucide]:size-4", md: "", lg: "h-28 w-24 [&_svg.lucide]:size-8" }

export function IconStackBlock({ icon, caption, size, color, align }: BlockProps<IconStackProps>) {
  return (
    <div
      className={cn(
        elementFrame,
        "flex flex-col gap-2",
        align === "center" ? "items-center text-center" : align === "right" ? "items-end text-right" : "items-start"
      )}
    >
      <IconStack className={cn(stackSize[size])}>
        <span style={hex.test(color ?? "") ? { color } : undefined} className="flex">
          <PageIcon name={icon} className="size-6" />
        </span>
      </IconStack>
      {caption ? <p className="text-sm font-medium">{caption}</p> : null}
    </div>
  )
}

// --- Dialog -------------------------------------------------------------------------------------

export type DialogProps = {
  trigger_label: string
  trigger_variant: "default" | "outline" | "secondary" | "ghost"
  title: string
  description: string
  size: "sm" | "md" | "lg"
  align: Align
  body: Slot
}

const dialogWidth = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-3xl" }

/**
 * Tombol yang membuka dialog berisi komponen lain. Di editor isi dialognya
 * tampil di bawah tombol (bertanda pratinjau), supaya bisa disusun.
 */
export function DialogBlock({ trigger_label, trigger_variant, title, description, size, align, body, puck }: SlotBlockProps<DialogProps, "body">) {
  const content = (
    <>
      <DialogHeader>
        {title ? <DialogTitle>{title}</DialogTitle> : null}
        {description ? <DialogDescription>{description}</DialogDescription> : null}
      </DialogHeader>
      {body({ className: cn(stackVars, "flex flex-col gap-4"), minEmptyHeight: 64 })}
    </>
  )
  const trigger = cn(buttonVariants({ variant: trigger_variant }))
  if (puck.isEditing) {
    return (
      <div className={cn(elementFrame, "flex flex-col gap-3")}>
        <div className={cn("flex", justify[align])}>
          <span className={trigger}>{trigger_label}</span>
        </div>
        <div className={cn("flex flex-col gap-4 rounded-xl border border-dashed bg-card p-5", dialogWidth[size])}>
          <p className="text-xs font-medium text-muted-foreground">Isi dialog (pratinjau di editor)</p>
          <div className="flex flex-col gap-1.5">
            {title ? <p className="text-lg font-semibold">{title}</p> : null}
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {body({ className: cn(stackVars, "flex flex-col gap-4"), minEmptyHeight: 64 })}
        </div>
      </div>
    )
  }
  return (
    <div className={cn(elementFrame, "flex", justify[align])}>
      <Dialog>
        <DialogTrigger className={trigger}>{trigger_label}</DialogTrigger>
        <DialogContent className={dialogWidth[size]}>{content}</DialogContent>
      </Dialog>
    </div>
  )
}

// --- Tabel --------------------------------------------------------------------------------------

export type TableProps = {
  header: string
  rows: { cells: string }[]
  variant: "plain" | "striped" | "bordered" | "card"
  first_column: "normal" | "bold"
}

/** Sel dipisah "|": "Dasar | Rp150.000 | Satu layanan". */
function cellsOf(text: string): string[] {
  return text.split("|").map((cell) => cell.trim())
}

/**
 * Tabel isi halaman. Disusun dengan grid berperan tabel (role="table"), sama
 * terbacanya bagi pembaca layar, dengan gaya tabel shadcn.
 */
export function TableBlock({ header, rows, variant, first_column }: BlockProps<TableProps>) {
  const head = cellsOf(header).filter(Boolean)
  const body = rows.map((row) => cellsOf(row.cells))
  const columns = Math.max(head.length, ...body.map((cells) => cells.length), 1)
  const grid = { gridTemplateColumns: `repeat(${columns}, minmax(8rem, 1fr))` }
  const cell = (text: string, column: number, header = false) => (
    <div
      key={column}
      role={header ? "columnheader" : column === 0 && first_column === "bold" ? "rowheader" : "cell"}
      className={cn(
        "px-3 py-2.5 text-sm",
        header ? "font-medium text-muted-foreground" : "text-pretty",
        !header && column === 0 && first_column === "bold" && "font-medium",
        variant === "bordered" && "border-r last:border-r-0"
      )}
    >
      {text}
    </div>
  )
  return (
    <div className={elementFrame}>
      <div className={cn("overflow-x-auto", (variant === "card" || variant === "bordered") && "rounded-xl border", variant === "card" && "bg-card shadow-xs")}>
        <div role="table" className="min-w-full">
          {head.length > 0 ? (
            <div role="row" className={cn("grid border-b", variant === "card" && "bg-muted/50")} style={grid}>
              {Array.from({ length: columns }, (_, column) => cell(head[column] ?? "", column, true))}
            </div>
          ) : null}
          {body.map((cells, index) => (
            <div
              key={index}
              role="row"
              className={cn("grid border-b last:border-b-0 hover:bg-muted/40", variant === "striped" && "even:bg-muted/50")}
              style={grid}
            >
              {Array.from({ length: columns }, (_, column) => cell(cells[column] ?? "", column))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// --- Linimasa -----------------------------------------------------------------------------------

export type TimelineProps = {
  items: { date: string; title: string; description: string; icon: string }[]
  orientation: "vertical" | "horizontal"
  /** Langkah yang sudah dilalui (diwarnai); 0 = semua. */
  progress: number
  marker: "dot" | "icon"
}

export function TimelineBlock({ items, orientation, progress, marker }: BlockProps<TimelineProps>) {
  const done = progress > 0 ? progress : items.length
  return (
    <div className={elementFrame}>
      <Timeline defaultValue={done} orientation={orientation} key={`${done}-${orientation}`}>
        {items.map((item, index) => (
          <TimelineItem key={index} step={index + 1}>
            <TimelineHeader>
              <TimelineSeparator />
              {item.date ? <TimelineDate>{item.date}</TimelineDate> : null}
              <TimelineTitle>{item.title}</TimelineTitle>
              <TimelineIndicator
                className={cn(
                  marker === "icon" &&
                    item.icon &&
                    "flex size-6 items-center justify-center border-none bg-primary/10 text-primary group-data-completed/timeline-item:bg-primary group-data-completed/timeline-item:text-primary-foreground [&_svg]:size-3.5"
                )}
              >
                {marker === "icon" && item.icon ? <PageIcon name={item.icon} /> : null}
              </TimelineIndicator>
            </TimelineHeader>
            {item.description ? <TimelineContent className="text-pretty">{item.description}</TimelineContent> : null}
          </TimelineItem>
        ))}
      </Timeline>
    </div>
  )
}
