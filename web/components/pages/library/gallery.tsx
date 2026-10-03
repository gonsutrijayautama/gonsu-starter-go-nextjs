"use client"

import Image from "next/image"
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import type { ComponentConfig, PuckContext } from "@puckeditor/core"
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsLeftRightIcon } from "lucide-react"
import { cn } from "cn"

import { Badge } from "@/components/reui/badge"
import { Button } from "@/components/ui/button"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"

import { BlockImage, resolveLink, Section, useOverlayPortal, type BlockProps } from "../blocks"
import { imageField, introFields, layoutField, linkField, showFields, sk, yesNoField } from "../fields"
import { SectionIntro } from "./kit"

// Galeri, sebelum–sesudah, dan portofolio.

const { t, s, i, c, a, o, w, intro } = sk

// --- Galeri ------------------------------------------------------------------------------------

type Photo = { image: string | null; caption: string }

export type GalleryProps = {
  eyebrow: string
  title: string
  subtitle: string
  variant: "grid" | "masonry" | "carousel" | "bento"
  columns: "2" | "3" | "4"
  lightbox: "yes" | "no"
  items: Photo[]
}

const gridColumns = { "2": "grid-cols-2", "3": "grid-cols-2 lg:grid-cols-3", "4": "grid-cols-2 lg:grid-cols-4" }
const masonryColumns = { "2": "columns-2", "3": "columns-2 lg:columns-3", "4": "columns-2 lg:columns-4" }
const carouselBasis = { "2": "basis-4/5 sm:basis-1/2", "3": "basis-4/5 sm:basis-1/2 lg:basis-1/3", "4": "basis-4/5 sm:basis-1/3 lg:basis-1/4" }
/** Bento: pola ukuran petak yang berulang setiap enam foto. */
const bentoSpan = ["col-span-2 row-span-2", "", "", "col-span-2", "", ""]

/** Tampilan penuh satu foto, dengan foto sebelum dan sesudahnya. */
function Lightbox({ photos, index, onIndex }: { photos: Photo[]; index: number | null; onIndex: (index: number | null) => void }) {
  const photo = index === null ? null : photos[index]
  const step = (by: number) => index !== null && onIndex((index + by + photos.length) % photos.length)
  return (
    <Dialog open={photo !== null} onOpenChange={(open) => !open && onIndex(null)}>
      <DialogContent
        className="max-w-[min(64rem,calc(100vw-2rem))] gap-3 p-3 sm:max-w-[min(64rem,calc(100vw-2rem))]"
        onKeyDown={(event: KeyboardEvent) => {
          if (event.key === "ArrowRight") step(1)
          if (event.key === "ArrowLeft") step(-1)
        }}
      >
        <DialogTitle className="sr-only">{photo?.caption || `Foto ${(index ?? 0) + 1}`}</DialogTitle>
        {photo?.image ? (
          <div className="relative h-[min(75vh,48rem)] w-full overflow-hidden rounded-lg bg-muted">
            <Image src={photo.image} alt={photo.caption} fill unoptimized className="object-contain" />
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 px-1">
          <DialogDescription className="text-sm">
            {photo?.caption || ""}
            <span className="ml-2 text-muted-foreground tabular-nums">
              {(index ?? 0) + 1}/{photos.length}
            </span>
          </DialogDescription>
          {photos.length > 1 ? (
            <div className="flex gap-1">
              <Button type="button" variant="outline" size="icon" aria-label="Foto sebelumnya" onClick={() => step(-1)}>
                <ChevronLeftIcon />
              </Button>
              <Button type="button" variant="outline" size="icon" aria-label="Foto berikutnya" onClick={() => step(1)}>
                <ChevronRightIcon />
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function GalleryBlock({ eyebrow, title, subtitle, variant, columns, lightbox, items, puck }: BlockProps<GalleryProps>) {
  const [open, setOpen] = useState<number | null>(null)
  const photos = puck.isEditing ? items : items.filter((item) => item.image)
  const zoom = lightbox === "yes" && !puck.isEditing
  const cols = columns in gridColumns ? columns : "3"

  const tile = (photo: Photo, index: number, className: string, natural = false) => {
    const picture =
      natural && photo.image ? (
        // Susunan bata: tinggi foto mengikuti foto aslinya.
        <Image src={photo.image} alt={photo.caption} width={800} height={600} unoptimized className="h-auto w-full rounded-xl border object-cover" />
      ) : (
        <BlockImage src={photo.image} alt={photo.caption} className={className} puck={puck} />
      )
    return (
      <figure className="flex h-full flex-col gap-2">
        {zoom ? (
          <button
            type="button"
            onClick={() => setOpen(index)}
            aria-label={`Perbesar ${photo.caption || `foto ${index + 1}`}`}
            className="block h-full cursor-zoom-in overflow-hidden rounded-xl transition hover:opacity-90"
          >
            {picture}
          </button>
        ) : (
          picture
        )}
        {photo.caption && variant !== "bento" ? <figcaption className="text-sm text-muted-foreground">{photo.caption}</figcaption> : null}
      </figure>
    )
  }

  let body
  if (variant === "masonry") {
    body = (
      <div className={cn("gap-4", masonryColumns[cols])}>
        {photos.map((photo, index) => (
          <div key={index} className="mb-4 break-inside-avoid">
            {tile(photo, index, "aspect-4/3 w-full", true)}
          </div>
        ))}
      </div>
    )
  } else if (variant === "carousel") {
    body = (
      <Carousel opts={{ align: "start" }} className="relative">
        <CarouselContent>
          {photos.map((photo, index) => (
            <CarouselItem key={index} className={carouselBasis[cols]}>
              {tile(photo, index, "aspect-4/3 w-full")}
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-3 bg-background/80 backdrop-blur" />
        <CarouselNext className="right-3 bg-background/80 backdrop-blur" />
      </Carousel>
    )
  } else if (variant === "bento") {
    body = (
      <ul className="grid auto-rows-[9rem] grid-cols-2 gap-3 sm:auto-rows-[11rem] md:grid-cols-4">
        {photos.map((photo, index) => (
          <li key={index} className={cn(bentoSpan[index % bentoSpan.length])}>
            {tile(photo, index, "size-full")}
          </li>
        ))}
      </ul>
    )
  } else {
    body = (
      <ul className={cn("grid gap-4", gridColumns[cols])}>
        {photos.map((photo, index) => (
          <li key={index}>{tile(photo, index, "aspect-square w-full")}</li>
        ))}
      </ul>
    )
  }

  return (
    <Section className="flex flex-col gap-10">
      <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
      {body}
      {zoom ? <Lightbox photos={photos} index={open} onIndex={setOpen} /> : null}
    </Section>
  )
}

export const galleryConfig: ComponentConfig<GalleryProps> = {
  label: "Galeri",
  fields: {
    variant: layoutField<GalleryProps["variant"]>("Susunan", [
      {
        value: "grid",
        label: "Kisi rata",
        sketch: [...intro(30, 2, 22), i(5, 9, 15, 11), i(22.5, 9, 15, 11), i(40, 9, 15, 11), i(5, 22, 15, 11), i(22.5, 22, 15, 11), i(40, 22, 15, 11)],
      },
      {
        value: "masonry",
        label: "Susunan bata",
        sketch: [...intro(30, 2, 22), i(5, 9, 15, 14), i(22.5, 9, 15, 9), i(40, 9, 15, 12), i(5, 25, 15, 9), i(22.5, 20, 15, 14), i(40, 23, 15, 11)],
      },
      {
        value: "carousel",
        label: "Bergeser",
        sketch: [...intro(30, 2, 22), i(4, 11, 20, 18), i(26, 11, 20, 18), i(48, 11, 12, 18), o(2, 18, 4), o(54, 18, 4)],
      },
      { value: "bento", label: "Bento", sketch: [...intro(30, 2, 22), i(5, 9, 24, 24), i(31, 9, 11, 11), i(44, 9, 11, 11), i(31, 22, 24, 11)] },
    ]),
    ...introFields,
    columns: {
      type: "radio",
      label: "Jumlah kolom",
      options: [
        { label: "2", value: "2" },
        { label: "3", value: "3" },
        { label: "4", value: "4" },
      ],
    },
    lightbox: yesNoField("Foto bisa diperbesar saat diklik"),
    items: {
      type: "array",
      label: "Foto",
      max: 60,
      getItemSummary: (item, index) => item.caption || `Foto ${(index ?? 0) + 1}`,
      defaultItemProps: { image: null, caption: "" },
      arrayFields: { image: imageField("Foto"), caption: { type: "text", label: "Keterangan" } },
    },
  },
  resolveFields: showFields<GalleryProps>({ columns: (props) => props.variant !== "bento" }),
  defaultProps: {
    eyebrow: "",
    title: "Galeri",
    subtitle: "",
    variant: "grid",
    columns: "3",
    lightbox: "yes",
    items: Array.from({ length: 6 }, () => ({ image: null, caption: "" })),
  },
  render: (props) => <GalleryBlock {...props} />,
}

// --- Sebelum–sesudah ---------------------------------------------------------------------------

type Pair = { before: string | null; after: string | null; caption: string }

export type BeforeAfterProps = {
  eyebrow: string
  title: string
  subtitle: string
  variant: "slider" | "side"
  before_label: string
  after_label: string
  ratio: "16/9" | "4/3" | "1/1"
  items: Pair[]
}

const ratioClass = { "16/9": "aspect-video", "4/3": "aspect-4/3", "1/1": "aspect-square" }

/** Dua foto bertumpuk; garis di tengah digeser (tetikus, sentuh, atau panah) untuk membandingkan. */
function CompareSlider({ pair, labels, ratio, puck }: { pair: Pair; labels: [string, string]; ratio: string; puck: PuckContext }) {
  const [position, setPosition] = useState(50)
  const area = useRef<HTMLDivElement>(null)
  const portal = useOverlayPortal(puck)
  const moveTo = (clientX: number) => {
    const box = area.current?.getBoundingClientRect()
    if (!box || box.width === 0) return
    setPosition(Math.min(100, Math.max(0, ((clientX - box.left) / box.width) * 100)))
  }
  return (
    <div
      ref={(element) => {
        area.current = element
        // Bisa digeser langsung di editor (overlay portal).
        return portal(element)
      }}
      className={cn("relative touch-none overflow-hidden rounded-2xl border bg-muted select-none", ratio)}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        moveTo(event.clientX)
      }}
      onPointerMove={(event: PointerEvent<HTMLDivElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) moveTo(event.clientX)
      }}
    >
      <BlockImage src={pair.after} alt={labels[1]} className="absolute inset-0 size-full rounded-none border-0" puck={puck} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <BlockImage src={pair.before} alt={labels[0]} className="size-full rounded-none border-0" puck={puck} />
      </div>
      <span className="absolute top-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">{labels[0]}</span>
      <span className="absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">{labels[1]}</span>
      <div aria-hidden="true" className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow" style={{ left: `${position}%` }} />
      <div
        role="slider"
        tabIndex={0}
        aria-label={`Geser untuk membandingkan ${labels[0].toLowerCase()} dan ${labels[1].toLowerCase()}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") setPosition((value) => Math.max(0, value - 5))
          if (event.key === "ArrowRight") setPosition((value) => Math.min(100, value + 5))
        }}
        className="absolute top-1/2 flex size-10 -translate-1/2 cursor-ew-resize items-center justify-center rounded-full border-2 border-white bg-black/50 text-white shadow-lg backdrop-blur outline-none focus-visible:ring-3 focus-visible:ring-ring"
        style={{ left: `${position}%` }}
      >
        <ChevronsLeftRightIcon aria-hidden="true" className="size-5" />
      </div>
    </div>
  )
}

export function BeforeAfterBlock({ eyebrow, title, subtitle, variant, before_label, after_label, ratio, items, puck }: BlockProps<BeforeAfterProps>) {
  const pairs = puck.isEditing ? items : items.filter((pair) => pair.before && pair.after)
  const labels: [string, string] = [before_label || "Sebelum", after_label || "Sesudah"]
  const shape = ratioClass[ratio] ?? "aspect-4/3"
  return (
    <Section className="flex flex-col gap-10">
      <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <ul className={cn("grid gap-8", pairs.length > 1 && variant === "slider" && "md:grid-cols-2")}>
        {pairs.map((pair, index) => (
          <li key={index} className="flex flex-col gap-3">
            {variant === "side" ? (
              <div className="grid grid-cols-2 gap-3">
                {([pair.before, pair.after] as const).map((image, side) => (
                  <figure key={side} className="relative">
                    <BlockImage src={image} alt={labels[side] ?? ""} className={cn("w-full rounded-2xl", shape)} puck={puck} />
                    <figcaption className="absolute top-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
                      {labels[side]}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <CompareSlider pair={pair} labels={labels} ratio={shape} puck={puck} />
            )}
            {pair.caption ? <p className="text-center text-sm text-muted-foreground">{pair.caption}</p> : null}
          </li>
        ))}
      </ul>
    </Section>
  )
}

export const beforeAfterConfig: ComponentConfig<BeforeAfterProps> = {
  label: "Sebelum–sesudah",
  fields: {
    variant: layoutField<BeforeAfterProps["variant"]>("Susunan", [
      { value: "slider", label: "Digeser", sketch: [...intro(30, 2, 22), i(8, 10, 22, 23), a(30, 10, 22, 23), w(29.5, 10, 1, 23), o(27.5, 19, 5)] },
      { value: "side", label: "Berdampingan", sketch: [...intro(30, 2, 22), i(6, 10, 23, 23), a(31, 10, 23, 23), s(8, 12, 7), s(33, 12, 7)] },
    ]),
    ...introFields,
    before_label: { type: "text", label: "Label foto sebelum" },
    after_label: { type: "text", label: "Label foto sesudah" },
    ratio: {
      type: "radio",
      label: "Bentuk foto",
      options: [
        { label: "Lebar", value: "16/9" },
        { label: "Foto", value: "4/3" },
        { label: "Persegi", value: "1/1" },
      ],
    },
    items: {
      type: "array",
      label: "Pasangan foto",
      max: 12,
      getItemSummary: (pair, index) => pair.caption || `Pasangan ${(index ?? 0) + 1}`,
      defaultItemProps: { before: null, after: null, caption: "" },
      arrayFields: { before: imageField("Foto sebelum"), after: imageField("Foto sesudah"), caption: { type: "text", label: "Keterangan" } },
    },
  },
  defaultProps: {
    eyebrow: "Hasil kerja",
    title: "Sebelum dan sesudah",
    subtitle: "Geser garisnya untuk melihat perbedaannya.",
    variant: "slider",
    before_label: "Sebelum",
    after_label: "Sesudah",
    ratio: "4/3",
    items: [{ before: null, after: null, caption: "" }],
  },
  render: (props) => <BeforeAfterBlock {...props} />,
}

// --- Portofolio --------------------------------------------------------------------------------

type Project = { image: string | null; title: string; category: string; description: string; link: string }

export type PortfolioProps = {
  eyebrow: string
  title: string
  subtitle: string
  variant: "grid" | "overlay" | "list"
  filter: "yes" | "no"
  items: Project[]
}

function ProjectLink({ project, puck, className }: { project: Project; puck: PuckContext; className?: string }) {
  const target = resolveLink(project.link, puck)
  if (!target) return null
  return (
    <a
      href={puck.isEditing ? undefined : target}
      className={cn("inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline", className)}
    >
      Lihat proyek
      <ArrowRightIcon aria-hidden="true" className="size-3.5" />
    </a>
  )
}

export function PortfolioBlock({ eyebrow, title, subtitle, variant, filter, items, puck }: BlockProps<PortfolioProps>) {
  const [category, setCategory] = useState("")
  const portal = useOverlayPortal(puck)
  const projects = items.filter((project) => project.title.trim() || project.image)
  const categories = [...new Set(projects.map((project) => project.category.trim()).filter(Boolean))]
  const shown = category ? projects.filter((project) => project.category.trim() === category) : projects

  let body
  if (variant === "overlay") {
    body = (
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((project, index) => (
          <li key={index} className="group relative isolate aspect-square overflow-hidden rounded-2xl">
            <BlockImage
              src={project.image}
              alt=""
              className="absolute inset-0 -z-10 size-full rounded-none border-0 transition duration-500 group-hover:scale-105"
              puck={puck}
            />
            <div className="flex size-full flex-col justify-end gap-1 bg-linear-to-t from-black/80 via-black/20 to-transparent p-5 text-white">
              {project.category ? <span className="text-xs font-medium tracking-wide uppercase opacity-80">{project.category}</span> : null}
              <span className="text-lg font-semibold">{project.title}</span>
              <ProjectLink project={project} puck={puck} className="text-white" />
            </div>
          </li>
        ))}
      </ul>
    )
  } else if (variant === "list") {
    body = (
      <ul className="flex flex-col gap-12">
        {shown.map((project, index) => (
          <li key={index} className="grid items-center gap-6 md:grid-cols-2 md:gap-12">
            <BlockImage src={project.image} alt="" className={cn("aspect-4/3 w-full rounded-2xl", index % 2 === 1 && "md:order-2")} puck={puck} />
            <div className="flex flex-col items-start gap-3">
              {project.category ? (
                <Badge variant="outline" radius="full">
                  {project.category}
                </Badge>
              ) : null}
              <h3 className="text-2xl font-semibold tracking-tight">{project.title}</h3>
              {project.description ? <p className="text-pretty text-muted-foreground">{project.description}</p> : null}
              <ProjectLink project={project} puck={puck} />
            </div>
          </li>
        ))}
      </ul>
    )
  } else {
    body = (
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((project, index) => (
          <li key={index} className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs">
            <BlockImage src={project.image} alt="" className="aspect-4/3 w-full rounded-none border-0 border-b" puck={puck} />
            <div className="flex flex-1 flex-col items-start gap-2 p-5">
              {project.category ? <span className="text-xs font-medium text-muted-foreground">{project.category}</span> : null}
              <h3 className="font-semibold">{project.title}</h3>
              {project.description ? <p className="text-sm text-pretty text-muted-foreground">{project.description}</p> : null}
              <ProjectLink project={project} puck={puck} className="mt-auto pt-2" />
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <Section className="flex flex-col gap-10">
      <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
      {filter === "yes" && categories.length > 1 ? (
        <div role="group" aria-label="Saring menurut kategori" className="flex flex-wrap justify-center gap-2">
          {["", ...categories].map((name) => (
            <Button
              key={name || "semua"}
              ref={portal}
              type="button"
              variant={category === name ? "default" : "outline"}
              aria-pressed={category === name}
              className="rounded-full"
              onClick={() => setCategory(name)}
            >
              {name || "Semua"}
            </Button>
          ))}
        </div>
      ) : null}
      {body}
    </Section>
  )
}

const project = (title: string, category: string, description: string): Project => ({ image: null, title, category, description, link: "" })

export const portfolioConfig: ComponentConfig<PortfolioProps> = {
  label: "Portofolio",
  fields: {
    variant: layoutField<PortfolioProps["variant"]>("Susunan", [
      {
        value: "grid",
        label: "Kartu",
        sketch: [
          ...intro(30, 2, 22),
          c(5, 9, 15, 24),
          i(5, 9, 15, 11),
          t(7, 23, 9),
          s(7, 27, 11),
          c(22.5, 9, 15, 24),
          i(22.5, 9, 15, 11),
          t(24.5, 23, 9),
          c(40, 9, 15, 24),
          i(40, 9, 15, 11),
          t(42, 23, 9),
        ],
      },
      {
        value: "overlay",
        label: "Foto bertulisan",
        sketch: [...intro(30, 2, 22), i(5, 9, 15, 24), w(7, 28, 9, 1.6), i(22.5, 9, 15, 24), w(24.5, 28, 9, 1.6), i(40, 9, 15, 24), w(42, 28, 9, 1.6)],
      },
      { value: "list", label: "Selang-seling", sketch: [i(4, 3, 24, 14), t(32, 6, 18), s(32, 10.5, 22), i(32, 19, 24, 14), t(4, 22, 18), s(4, 26.5, 22)] },
    ]),
    ...introFields,
    filter: yesNoField("Saring menurut kategori"),
    items: {
      type: "array",
      label: "Proyek",
      max: 40,
      getItemSummary: (entry) => entry.title || "Proyek",
      defaultItemProps: project("Nama proyek", "", ""),
      arrayFields: {
        image: imageField("Foto"),
        title: { type: "text", label: "Nama proyek" },
        category: { type: "text", label: "Kategori", placeholder: "Rumah, Kantor, Toko…" },
        description: { type: "textarea", label: "Keterangan" },
        link: { ...linkField, label: "Tautan (boleh kosong)" },
      },
    },
  },
  defaultProps: {
    eyebrow: "Portofolio",
    title: "Hasil kerja kami",
    subtitle: "Sebagian proyek yang sudah kami kerjakan.",
    variant: "grid",
    filter: "yes",
    items: [
      project("Renovasi dapur", "Rumah", "Dapur sempit jadi lega dan terang."),
      project("Interior kafe", "Toko", "Nuansa hangat untuk 40 kursi."),
      project("Ruang rapat", "Kantor", "Akustik lebih baik, tampilan rapi."),
    ],
  },
  render: (props) => <PortfolioBlock {...props} />,
}
