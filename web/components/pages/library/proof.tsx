"use client"

import { useState, type ReactNode } from "react"
import type { ComponentConfig } from "@puckeditor/core"
import { QuoteIcon } from "lucide-react"
import { cn } from "cn"

import { IconTile } from "@/components/reui/icon-tile"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel"

import { BlockImage, Section, useOverlayPortal, type BlockProps } from "../blocks"
import { Marquee } from "../effects"
import { animateField, decimalsField, imageField, introFields, layoutField, linkField, numberFormatField, showFields, sk, when, yesNoField } from "../fields"
import { iconField } from "../field-kit"
import { PageIcon } from "../page-icon"
import { migrateStat, StatNumber, statOf, type NumberFormat, type StatValue } from "../stat-number"
import { Buttons, Logo, Person, SectionIntro, Stars } from "./kit"

// Bukti dan kepercayaan: testimoni, logo mitra, angka capaian, ringkasan
// ulasan, dan penghargaan.

const { t, s, i, c, a, o, p, w, intro, text } = sk

// --- Testimoni ---------------------------------------------------------------------------------

/** Data lama tidak punya `image` dan `rating`: keduanya bisa tidak ada. */
type Testimonial = { quote: string; name: string; role: string; image: string | null; rating: number }

export type TestimonialsProps = {
  eyebrow: string
  title: string
  subtitle: string
  variant: "single" | "grid" | "marquee" | "tilt" | "carousel"
  stars: "yes" | "no"
  items: Testimonial[]
}

function TestimonialCard({ item, stars, className }: { item: Testimonial; stars: boolean; className?: string }) {
  return (
    <figure className={cn("flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs", className)}>
      {stars && item.rating ? <Stars value={item.rating} /> : null}
      <blockquote className="text-sm text-pretty">{item.quote}</blockquote>
      <figcaption className="mt-auto flex items-center gap-3">
        <Person name={item.name} image={item.image} />
        <div className="flex min-w-0 flex-col text-sm">
          <span className="truncate font-semibold">{item.name}</span>
          {item.role ? <span className="truncate text-muted-foreground">{item.role}</span> : null}
        </div>
      </figcaption>
    </figure>
  )
}

/** Urutan butir yang digeser, supaya baris marquee tidak sama persis. */
function rotated<T>(items: T[], by: number): T[] {
  if (items.length === 0) return items
  const shift = by % items.length
  return [...items.slice(shift), ...items.slice(0, shift)]
}

function SingleQuote({ items, stars, puck }: { items: Testimonial[]; stars: boolean; puck: BlockProps<unknown>["puck"] }) {
  const [current, setCurrent] = useState(0)
  const portal = useOverlayPortal(puck)
  const item = items[Math.min(current, items.length - 1)]
  if (!item) return null
  return (
    <figure className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
      <QuoteIcon aria-hidden="true" className="size-8 text-muted-foreground/50" />
      {stars && item.rating ? <Stars value={item.rating} /> : null}
      <blockquote className="page-title text-2xl font-medium tracking-tight text-balance sm:text-3xl">“{item.quote}”</blockquote>
      <figcaption className="flex flex-col items-center gap-1">
        <span className="font-semibold">{item.name}</span>
        {item.role ? <span className="text-sm text-muted-foreground">{item.role}</span> : null}
      </figcaption>
      {items.length > 1 ? (
        // Foto pelanggan lain: diklik untuk berganti kutipan (juga di editor).
        <div role="group" aria-label="Pilih testimoni" className="flex gap-2">
          {items.map((entry, index) => (
            <button
              key={index}
              ref={portal}
              type="button"
              aria-label={`Testimoni ${entry.name}`}
              aria-pressed={index === current}
              onClick={() => setCurrent(index)}
              className={cn(
                "rounded-full ring-offset-2 ring-offset-background transition",
                index === current ? "ring-2 ring-primary" : "opacity-60 hover:opacity-100"
              )}
            >
              <Person name={entry.name} image={entry.image} />
            </button>
          ))}
        </div>
      ) : null}
    </figure>
  )
}

export function TestimonialsBlock({ eyebrow, title, subtitle, variant, stars, items, puck }: BlockProps<TestimonialsProps>) {
  const shown = items.filter((item) => item.quote.trim())
  const star = stars === "yes"
  let wall: ReactNode = null
  if (shown.length === 0) wall = null
  else if (variant === "single") wall = <SingleQuote items={shown} stars={star} puck={puck} />
  else if (variant === "carousel") {
    wall = (
      <Carousel opts={{ align: "start" }} className="relative">
        <CarouselContent>
          {shown.map((item, index) => (
            <CarouselItem key={index} className="basis-[85%] sm:basis-1/2 lg:basis-1/3">
              <TestimonialCard item={item} stars={star} className="h-full" />
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="mt-6 flex justify-center gap-2">
          <CarouselPrevious className="static translate-0" />
          <CarouselNext className="static translate-0" />
        </div>
      </Carousel>
    )
  } else if (variant === "tilt") {
    wall = (
      <div className="page-tilt relative h-[30rem] overflow-hidden">
        <div className="page-tilt-plane grid grid-cols-2 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((column) => (
            <Marquee
              key={column}
              vertical
              reverse={column % 2 === 1}
              seconds={Math.max(shown.length * 7, 28)}
              className={cn("h-[34rem]", column === 2 && "hidden md:flex")}
            >
              {rotated(shown, column).map((item, index) => (
                <TestimonialCard key={index} item={item} stars={star} />
              ))}
            </Marquee>
          ))}
        </div>
      </div>
    )
  } else if (variant === "marquee") {
    const seconds = Math.max(shown.length * 8, 30)
    wall = (
      <div className="flex flex-col gap-4">
        <Marquee seconds={seconds}>
          {shown.map((item, index) => (
            <TestimonialCard key={index} item={item} stars={star} className="w-80" />
          ))}
        </Marquee>
        <Marquee seconds={seconds} reverse>
          {rotated(shown, Math.ceil(shown.length / 2)).map((item, index) => (
            <TestimonialCard key={index} item={item} stars={star} className="w-80" />
          ))}
        </Marquee>
      </div>
    )
  } else {
    wall = (
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {shown.map((item, index) => (
          <TestimonialCard key={index} item={item} stars={star} className="mb-4 break-inside-avoid" />
        ))}
      </div>
    )
  }
  return (
    <Section className="flex flex-col gap-12">
      <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
      {wall}
    </Section>
  )
}

const quote = (text: string, name: string, role: string, rating = 5): Testimonial => ({ quote: text, name, role, image: null, rating })

export const testimonialsConfig: ComponentConfig<TestimonialsProps> = {
  label: "Testimoni",
  fields: {
    variant: layoutField<TestimonialsProps["variant"]>("Susunan", [
      {
        value: "single",
        label: "Satu kutipan besar",
        sketch: [s(28, 3, 4), t(10, 9, 40), t(14, 13.5, 32), s(24, 19, 12), o(21, 25, 5), o(27.5, 25, 5), o(34, 25, 5)],
      },
      {
        value: "grid",
        label: "Kisi kartu",
        sketch: [...intro(30, 2, 22), c(5, 9, 15, 13), c(22.5, 9, 15, 17), c(40, 9, 15, 12), c(5, 24, 15, 9), c(22.5, 28, 15, 5), c(40, 23, 15, 10)],
      },
      {
        value: "marquee",
        label: "Dua baris berjalan",
        sketch: [
          ...intro(30, 2, 22),
          c(-4, 10, 18, 10),
          c(16, 10, 18, 10),
          c(36, 10, 18, 10),
          c(56, 10, 18, 10),
          c(4, 23, 18, 10),
          c(24, 23, 18, 10),
          c(44, 23, 18, 10),
        ],
      },
      {
        value: "tilt",
        label: "Miring 3D",
        sketch: [
          c(8, 2, 13, 12),
          c(23.5, -3, 13, 12),
          c(39, 4, 13, 12),
          c(8, 16, 13, 12),
          c(23.5, 11, 13, 12),
          c(39, 18, 13, 12),
          c(8, 30, 13, 12),
          c(23.5, 25, 13, 12),
        ],
      },
      {
        value: "carousel",
        label: "Bergeser",
        sketch: [...intro(30, 2, 22), c(4, 10, 16, 18), c(22, 10, 16, 18), c(40, 10, 16, 18), o(25, 30, 4), o(31, 30, 4)],
      },
    ]),
    ...introFields,
    stars: yesNoField("Tampilkan bintang"),
    items: {
      type: "array",
      label: "Testimoni",
      max: 30,
      getItemSummary: (item) => item.name || "Tanpa nama",
      defaultItemProps: quote("Kalimat dari pelanggan.", "Nama pelanggan", ""),
      arrayFields: {
        quote: { type: "textarea", label: "Kutipan" },
        name: { type: "text", label: "Nama" },
        role: { type: "text", label: "Keterangan", placeholder: "Pelanggan sejak 2021" },
        image: imageField("Foto (kosong: avatar otomatis)"),
        rating: { type: "number", label: "Bintang (1–5)", min: 0, max: 5, step: 0.5 },
      },
    },
  },
  defaultProps: {
    eyebrow: "",
    title: "Kata pelanggan",
    subtitle: "",
    variant: "grid",
    stars: "yes",
    items: [
      quote("Pengerjaannya rapi dan tepat waktu. Pasti pesan lagi.", "Sari Wulandari", "Pelanggan sejak 2021"),
      quote("Timnya ramah, gampang dihubungi lewat WhatsApp.", "Budi Santoso", "Pemilik kafe"),
      quote("Harganya jelas dari awal, tidak ada biaya tambahan.", "Rina Wati", "Pelanggan"),
      quote("Hasilnya melebihi harapan saya.", "Agus Pratama", "Pelanggan", 4.5),
    ],
  },
  render: (props) => <TestimonialsBlock {...props} />,
}

/** Data lama: "Testimoni" tanpa susunan, dan "Testimoni berjalan" (TestimonialWall, `effect`). */
export function testimonialsFrom(type: string, props: Record<string, unknown>): Record<string, unknown> {
  if (props.variant) return props
  if (type === "TestimonialWall") return { ...props, variant: props.effect ?? "marquee", stars: "no" }
  return { ...props, variant: "grid", stars: "no" }
}

// --- Logo mitra --------------------------------------------------------------------------------

export type LogosProps = {
  title: string
  variant: "marquee" | "row" | "cards"
  grayscale: "yes" | "no"
  items: { name: string; image: string | null }[]
}

export function LogosBlock({ title, variant, grayscale, items }: BlockProps<LogosProps>) {
  const logos = items.filter((item) => item.name.trim() || item.image)
  if (logos.length === 0) return null
  const gray = grayscale === "yes"
  const list = logos.map((item, index) => <Logo key={index} name={item.name} image={item.image} grayscale={gray} />)
  return (
    <Section className="flex flex-col gap-8">
      {title ? <p className="text-center text-sm font-medium text-muted-foreground">{title}</p> : null}
      {variant === "marquee" ? (
        <Marquee seconds={Math.max(logos.length * 4, 20)} className="[--gap:3.5rem]">
          {list}
        </Marquee>
      ) : variant === "cards" ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {logos.map((item, index) => (
            <li key={index} className="flex h-20 items-center justify-center rounded-xl border bg-card px-4 shadow-xs">
              <Logo name={item.name} image={item.image} grayscale={gray} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">{list}</div>
      )}
    </Section>
  )
}

export const logosConfig: ComponentConfig<LogosProps> = {
  label: "Logo mitra",
  fields: {
    variant: layoutField<LogosProps["variant"]>("Susunan", [
      { value: "marquee", label: "Berjalan", sketch: [s(18, 8, 24), t(-4, 19, 9), t(9, 19, 9), t(22, 19, 9), t(35, 19, 9), t(48, 19, 9)] },
      { value: "row", label: "Satu baris diam", sketch: [s(18, 8, 24), t(6, 19, 9), t(18.5, 19, 9), t(31, 19, 9), t(43.5, 19, 9)] },
      {
        value: "cards",
        label: "Kotak logo",
        sketch: [
          s(18, 5, 24),
          c(5, 12, 15, 9),
          c(22.5, 12, 15, 9),
          c(40, 12, 15, 9),
          c(5, 23, 15, 9),
          c(22.5, 23, 15, 9),
          c(40, 23, 15, 9),
          t(8, 15.5, 9),
          t(25.5, 15.5, 9),
          t(43, 15.5, 9),
          t(8, 26.5, 9),
          t(25.5, 26.5, 9),
          t(43, 26.5, 9),
        ],
      },
    ]),
    title: { type: "text", label: "Kalimat di atas logo" },
    grayscale: yesNoField("Abu-abu, berwarna saat disorot"),
    items: {
      type: "array",
      label: "Logo",
      max: 24,
      getItemSummary: (item) => item.name || "Logo tanpa nama",
      defaultItemProps: { name: "Nama mitra", image: null },
      arrayFields: { name: { type: "text", label: "Nama (tampil bila tanpa gambar)" }, image: imageField("Gambar logo") },
    },
  },
  defaultProps: {
    title: "Dipercaya pelanggan dari berbagai usaha",
    variant: "marquee",
    grayscale: "yes",
    items: ["Maju Bersama", "Sumber Rejeki", "Karya Mandiri", "Sinar Abadi", "Berkah Jaya", "Mitra Usaha"].map((name) => ({ name, image: null })),
  },
  render: (props) => <LogosBlock {...props} />,
}

/** Data lama: `animate` ya/tidak tanpa susunan. */
export function logosFrom(_: string, props: Record<string, unknown>): Record<string, unknown> {
  if (props.variant) return props
  return { ...props, variant: props.animate === "no" ? "row" : "marquee" }
}

// --- Angka capaian -----------------------------------------------------------------------------

type StatItem = StatValue & { value?: string; label: string; description?: string }

export type StatsProps = {
  eyebrow: string
  title: string
  subtitle: string
  style: "plain" | "cards" | "image" | "bento"
  count: "yes" | "no"
  format: NumberFormat
  decimals: number
  image: string | null
  /** `value` hanya di data lama ("5.000+"); butir baru memakai number, prefix, dan suffix. */
  items: StatItem[]
}

function StatFigure({ item, props, className }: { item: StatItem; props: StatsProps; className: string }) {
  const stat = statOf(item)
  return (
    <span className={className}>
      <StatNumber
        number={stat.number}
        prefix={stat.prefix}
        suffix={stat.suffix}
        format={props.format ?? "plain"}
        decimals={props.decimals ?? stat.decimals ?? 0}
        animate={props.count === "yes"}
      />
    </span>
  )
}

export function StatsBlock(props: BlockProps<StatsProps>) {
  const { eyebrow, title, subtitle, style, items, image, puck } = props
  if (style === "bento") {
    const [first, ...rest] = items
    return (
      <Section className="flex flex-col gap-12">
        <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
        <dl className="grid gap-4 md:auto-rows-fr md:grid-cols-3">
          {first ? (
            <div className="@container flex flex-col justify-end gap-2 rounded-2xl bg-primary p-8 text-primary-foreground md:row-span-2">
              <StatFigure
                item={first}
                props={props}
                className="text-[min(4.5rem,22cqw)] leading-none font-semibold tracking-tight whitespace-nowrap tabular-nums"
              />
              <dt className="text-lg font-medium">{first.label}</dt>
              {first.description ? <dd className="text-sm text-pretty opacity-80">{first.description}</dd> : null}
            </div>
          ) : null}
          {rest.map((item, index) => (
            // Sisa ganjil: kartu terakhir melebar supaya tidak ada petak kosong.
            <div
              key={index}
              className={cn(
                "@container flex flex-col gap-1 rounded-2xl border bg-card p-6 shadow-xs",
                rest.length % 2 === 1 && index === rest.length - 1 && "md:col-span-2"
              )}
            >
              <StatFigure item={item} props={props} className="text-[min(2.5rem,16cqw)] font-semibold tracking-tight whitespace-nowrap tabular-nums" />
              <dt className="font-medium">{item.label}</dt>
              {item.description ? <dd className="text-sm text-pretty text-muted-foreground">{item.description}</dd> : null}
            </div>
          ))}
        </dl>
      </Section>
    )
  }
  if (style === "image") {
    return (
      <Section className={cn("grid items-center gap-12", (image || puck.isEditing) && "lg:grid-cols-2")}>
        {image || puck.isEditing ? <BlockImage src={image} alt="" className="aspect-4/3 w-full rounded-2xl shadow-lg" puck={puck} /> : null}
        <div className="flex flex-col gap-10">
          <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} align="left" />
          <dl className="grid grid-cols-2 gap-x-8 gap-y-8">
            {items.map((item, index) => (
              <div key={index} className="@container flex flex-col gap-1 border-l-2 border-primary pl-4">
                <StatFigure item={item} props={props} className="text-[min(2.75rem,18cqw)] font-semibold tracking-tight whitespace-nowrap tabular-nums" />
                <dt className="text-sm text-muted-foreground">{item.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </Section>
    )
  }
  return (
    <Section className="flex flex-col gap-12">
      <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <dl className={cn("grid grid-cols-2 gap-4", items.length >= 4 ? "lg:grid-cols-4" : items.length === 3 ? "lg:grid-cols-3" : "")}>
        {items.map((item, index) => (
          <div key={index} className={cn("@container flex flex-col-reverse gap-1 text-center", style === "cards" && "rounded-xl border bg-card p-6 shadow-xs")}>
            <dt className="text-sm text-muted-foreground">{item.label}</dt>
            <dd>
              <StatFigure item={item} props={props} className="text-[min(3rem,15cqw)] font-semibold tracking-tight whitespace-nowrap tabular-nums" />
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

export const statsConfig: ComponentConfig<StatsProps> = {
  label: "Angka capaian",
  fields: {
    style: layoutField<StatsProps["style"]>("Susunan", [
      {
        value: "plain",
        label: "Polos",
        sketch: [...intro(30, 3), t(6, 17, 10), s(7, 22, 8), t(20, 17, 10), s(21, 22, 8), t(34, 17, 10), s(35, 22, 8), t(48, 17, 8), s(48, 22, 8)],
      },
      {
        value: "cards",
        label: "Kartu",
        sketch: [
          ...intro(30, 3),
          c(4, 13, 12, 16),
          t(6, 17, 8),
          c(17.5, 13, 12, 16),
          t(19.5, 17, 8),
          c(31, 13, 12, 16),
          t(33, 17, 8),
          c(44.5, 13, 12, 16),
          t(46.5, 17, 8),
        ],
      },
      {
        value: "image",
        label: "Dengan gambar",
        sketch: [
          i(4, 5, 24, 26),
          ...text(32, 5, 20),
          a(32, 16, 0.8, 6),
          t(34, 16, 8),
          a(46, 16, 0.8, 6),
          t(48, 16, 8),
          a(32, 25, 0.8, 6),
          t(34, 25, 8),
          a(46, 25, 0.8, 6),
          t(48, 25, 8),
        ],
      },
      {
        value: "bento",
        label: "Bento",
        sketch: [
          ...intro(30, 2, 22),
          p(4, 10, 17, 23),
          w(7, 25, 9, 2.6),
          c(23, 10, 16, 11),
          t(25, 13, 8),
          c(41, 10, 15, 11),
          t(43, 13, 8),
          c(23, 22.5, 16, 10.5),
          t(25, 25.5, 8),
          c(41, 22.5, 15, 10.5),
          t(43, 25.5, 8),
        ],
      },
    ]),
    ...introFields,
    image: imageField("Gambar"),
    count: animateField,
    format: numberFormatField,
    decimals: decimalsField,
    items: {
      type: "array",
      label: "Angka",
      max: 8,
      getItemSummary: (item) => `${item.prefix ?? ""}${item.number ?? item.value ?? ""}${item.suffix ?? ""} ${item.label}`.trim() || "Angka kosong",
      defaultItemProps: { number: 100, prefix: "", suffix: "+", label: "Keterangan", description: "" },
      arrayFields: {
        number: { type: "number", label: "Angka" },
        prefix: { type: "text", label: "Awalan", placeholder: "Misalnya: ±" },
        suffix: { type: "text", label: "Akhiran", placeholder: "Misalnya: +, jam, pelanggan" },
        label: { type: "text", label: "Keterangan" },
        description: { type: "textarea", label: "Penjelasan (untuk susunan bento)" },
      },
    },
  },
  resolveFields: showFields<StatsProps>({ image: when("style", "image") }),
  defaultProps: {
    eyebrow: "",
    title: "Angka yang bicara",
    subtitle: "",
    style: "plain",
    count: "yes",
    format: "plain",
    decimals: 0,
    image: null,
    items: [
      { number: 10, prefix: "", suffix: "+", label: "Tahun melayani", description: "Sejak 2015 melayani pelanggan di seluruh kota." },
      { number: 5000, prefix: "", suffix: "+", label: "Pesanan selesai", description: "" },
      { number: 98, prefix: "", suffix: "%", label: "Pelanggan puas", description: "" },
      { number: 24, prefix: "", suffix: " jam", label: "Waktu tanggap", description: "" },
    ],
  },
  resolveData: ({ props }) => ({ props: { ...props, items: props.items.map(migrateStat) } }),
  render: (props) => <StatsBlock {...props} />,
}

// --- Ringkasan ulasan --------------------------------------------------------------------------

type Review = { name: string; rating: number; quote: string; date: string }

export type ReviewsProps = {
  eyebrow: string
  title: string
  subtitle: string
  variant: "summary" | "badge"
  source: string
  rating: number
  star5: number
  star4: number
  star3: number
  star2: number
  star1: number
  items: Review[]
  button_label: string
  button_link: string
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <figure className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <Person name={review.name} className="size-8" />
          <span className="text-sm font-semibold">{review.name}</span>
        </span>
        {review.date ? <span className="text-xs text-muted-foreground">{review.date}</span> : null}
      </div>
      <Stars value={review.rating} />
      <blockquote className="text-sm text-pretty text-muted-foreground">{review.quote}</blockquote>
    </figure>
  )
}

export function ReviewsBlock(props: BlockProps<ReviewsProps>) {
  const { eyebrow, title, subtitle, variant, source, rating, items, puck } = props
  const counts = [props.star5, props.star4, props.star3, props.star2, props.star1].map((count) => Math.max(0, count || 0))
  const total = counts.reduce((sum, count) => sum + count, 0)
  const reviews = items.filter((review) => review.quote.trim())
  const totalText = `${total.toLocaleString("id-ID")} ulasan${source ? ` di ${source}` : ""}`
  const button = <Buttons primary={{ label: props.button_label, link: props.button_link }} align={variant === "badge" ? "center" : "left"} puck={puck} />

  if (variant === "badge") {
    return (
      <Section className="flex flex-col items-center gap-10">
        <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
        <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card px-8 py-6 text-center shadow-sm">
          <span className="text-5xl font-semibold tracking-tight tabular-nums">
            {rating.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </span>
          <Stars value={rating} className="[&_svg]:size-5" />
          <span className="text-sm text-muted-foreground">{totalText}</span>
        </div>
        {reviews.length > 0 ? (
          <div className="grid w-full gap-4 md:grid-cols-3">
            {reviews.slice(0, 3).map((review, index) => (
              <ReviewCard key={index} review={review} />
            ))}
          </div>
        ) : null}
        {button}
      </Section>
    )
  }
  return (
    <Section className="flex flex-col gap-12">
      <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <div className="grid items-start gap-8 lg:grid-cols-[20rem_1fr]">
        <div className="flex flex-col gap-5 rounded-2xl border bg-card p-6 shadow-xs">
          <div className="flex items-end gap-3">
            <span className="text-5xl leading-none font-semibold tracking-tight tabular-nums">
              {rating.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <div className="flex flex-col gap-1 pb-0.5">
              <Stars value={rating} />
              <span className="text-xs text-muted-foreground">{totalText}</span>
            </div>
          </div>
          <dl className="flex flex-col gap-2">
            {counts.map((count, index) => (
              <div key={index} className="flex items-center gap-3 text-sm">
                <dt className="w-10 shrink-0 text-muted-foreground tabular-nums">{5 - index} ★</dt>
                <dd className="flex flex-1 items-center gap-3">
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-warning" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
                  </span>
                  <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{count.toLocaleString("id-ID")}</span>
                </dd>
              </div>
            ))}
          </dl>
          {button}
        </div>
        <div className="columns-1 gap-4 md:columns-2">
          {reviews.map((review, index) => (
            <div key={index} className="mb-4 break-inside-avoid">
              <ReviewCard review={review} />
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

const starField = (stars: number) => ({ type: "number", label: `Jumlah ulasan ${stars} bintang`, min: 0 }) as const

export const reviewsConfig: ComponentConfig<ReviewsProps> = {
  label: "Ringkasan ulasan",
  fields: {
    variant: layoutField<ReviewsProps["variant"]>("Susunan", [
      {
        value: "summary",
        label: "Nilai dan ulasan",
        sketch: [
          ...intro(30, 2, 22),
          c(4, 10, 18, 23),
          t(7, 13, 7),
          a(7, 19, 12, 1.3),
          a(7, 22, 9, 1.3),
          a(7, 25, 4, 1.3),
          c(25, 10, 15, 12),
          c(42, 10, 15, 16),
          c(25, 24, 15, 9),
        ],
      },
      {
        value: "badge",
        label: "Lencana di tengah",
        sketch: [...intro(30, 2, 22), c(22, 9, 16, 11), t(26, 11.5, 8), a(25, 16, 10, 1.6), c(5, 23, 15, 10), c(22.5, 23, 15, 10), c(40, 23, 15, 10)],
      },
    ]),
    ...introFields,
    source: { type: "text", label: "Sumber ulasan", placeholder: "Google, Tokopedia, GoFood…" },
    rating: { type: "number", label: "Nilai rata-rata", min: 0, max: 5, step: 0.1 },
    star5: starField(5),
    star4: starField(4),
    star3: starField(3),
    star2: starField(2),
    star1: starField(1),
    items: {
      type: "array",
      label: "Ulasan pilihan",
      max: 12,
      getItemSummary: (review) => review.name || "Ulasan",
      defaultItemProps: { name: "Nama", rating: 5, quote: "Isi ulasan.", date: "" },
      arrayFields: {
        name: { type: "text", label: "Nama" },
        rating: { type: "number", label: "Bintang", min: 1, max: 5 },
        quote: { type: "textarea", label: "Isi ulasan" },
        date: { type: "text", label: "Waktu", placeholder: "2 minggu lalu" },
      },
    },
    button_label: { type: "text", label: "Teks tombol", placeholder: "Lihat semua ulasan" },
    button_link: linkField,
  },
  defaultProps: {
    eyebrow: "Ulasan",
    title: "Dinilai tinggi oleh pelanggan",
    subtitle: "",
    variant: "summary",
    source: "Google",
    rating: 4.8,
    star5: 412,
    star4: 58,
    star3: 9,
    star2: 3,
    star1: 2,
    items: [
      { name: "Dewi Lestari", rating: 5, quote: "Pelayanannya cepat dan ramah. Tempatnya bersih.", date: "2 minggu lalu" },
      { name: "Hendra Gunawan", rating: 5, quote: "Harga sesuai kualitas. Sudah langganan dua tahun.", date: "1 bulan lalu" },
      { name: "Maya Putri", rating: 4, quote: "Bagus, hanya antre sedikit saat akhir pekan.", date: "1 bulan lalu" },
    ],
    button_label: "",
    button_link: "",
  },
  render: (props) => <ReviewsBlock {...props} />,
}

// --- Penghargaan & sertifikat ------------------------------------------------------------------

type Award = { icon: string; image: string | null; title: string; issuer: string; year: string }

export type AwardsProps = {
  eyebrow: string
  title: string
  subtitle: string
  variant: "badges" | "cards" | "list"
  items: Award[]
}

function AwardMark({ award, puck, large }: { award: Award; puck: BlockProps<unknown>["puck"]; large?: boolean }) {
  if (award.image)
    return <BlockImage src={award.image} alt="" className={cn("shrink-0 rounded-full bg-background", large ? "size-24" : "size-12")} puck={puck} />
  if (large) {
    return (
      <span aria-hidden="true" className="flex size-24 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <PageIcon name={award.icon || "award"} className="size-10" />
      </span>
    )
  }
  return (
    <IconTile variant="solid" aria-hidden="true">
      <PageIcon name={award.icon || "award"} />
    </IconTile>
  )
}

export function AwardsBlock({ eyebrow, title, subtitle, variant, items, puck }: BlockProps<AwardsProps>) {
  const awards = items.filter((award) => award.title.trim())
  let body
  if (variant === "cards") {
    body = (
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {awards.map((award, index) => (
          <li key={index} className="flex items-start gap-4 rounded-2xl border bg-card p-5 shadow-xs">
            <AwardMark award={award} puck={puck} />
            <div className="flex flex-col gap-1">
              <span className="font-semibold">{award.title}</span>
              <span className="text-sm text-muted-foreground">{[award.issuer, award.year].filter(Boolean).join(" · ")}</span>
            </div>
          </li>
        ))}
      </ul>
    )
  } else if (variant === "list") {
    body = (
      <ol className="mx-auto flex w-full max-w-3xl flex-col divide-y rounded-2xl border bg-card">
        {awards.map((award, index) => (
          <li key={index} className="flex items-center gap-5 p-5">
            <span className="w-14 shrink-0 text-lg font-semibold text-muted-foreground tabular-nums">{award.year}</span>
            <div className="flex flex-1 flex-col">
              <span className="font-semibold">{award.title}</span>
              {award.issuer ? <span className="text-sm text-muted-foreground">{award.issuer}</span> : null}
            </div>
            <AwardMark award={award} puck={puck} />
          </li>
        ))}
      </ol>
    )
  } else {
    body = (
      <ul className="flex flex-wrap justify-center gap-x-10 gap-y-8">
        {awards.map((award, index) => (
          <li key={index} className="flex w-40 flex-col items-center gap-3 text-center">
            <span className="rounded-full border-4 border-muted p-1">
              <AwardMark award={award} puck={puck} large />
            </span>
            <span className="text-sm font-semibold text-balance">{award.title}</span>
            <span className="text-xs text-muted-foreground">{[award.issuer, award.year].filter(Boolean).join(" · ")}</span>
          </li>
        ))}
      </ul>
    )
  }
  return (
    <Section className="flex flex-col gap-12">
      <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
      {body}
    </Section>
  )
}

const award = (title: string, issuer: string, year: string, icon: string): Award => ({ icon, image: null, title, issuer, year })

export const awardsConfig: ComponentConfig<AwardsProps> = {
  label: "Penghargaan & sertifikat",
  fields: {
    variant: layoutField<AwardsProps["variant"]>("Susunan", [
      {
        value: "badges",
        label: "Lencana",
        sketch: [
          ...intro(30, 2, 22),
          o(7, 11, 11),
          s(7, 25, 11),
          o(19.5, 11, 11),
          s(19.5, 25, 11),
          o(32, 11, 11),
          s(32, 25, 11),
          o(44.5, 11, 11),
          s(44.5, 25, 11),
        ],
      },
      {
        value: "cards",
        label: "Kartu",
        sketch: [
          ...intro(30, 2, 22),
          c(4, 11, 25, 10),
          o(6, 13, 6),
          t(14, 14, 12),
          c(31, 11, 25, 10),
          o(33, 13, 6),
          t(41, 14, 12),
          c(4, 23, 25, 10),
          o(6, 25, 6),
          t(14, 26, 12),
          c(31, 23, 25, 10),
          o(33, 25, 6),
          t(41, 26, 12),
        ],
      },
      {
        value: "list",
        label: "Daftar bertahun",
        sketch: [
          ...intro(30, 2, 22),
          c(10, 10, 40, 23),
          t(13, 13.5, 5),
          s(21, 13.5, 20),
          o(43, 12.5, 4),
          t(13, 20.5, 5),
          s(21, 20.5, 18),
          o(43, 19.5, 4),
          t(13, 27.5, 5),
          s(21, 27.5, 20),
          o(43, 26.5, 4),
        ],
      },
    ]),
    ...introFields,
    items: {
      type: "array",
      label: "Penghargaan",
      max: 24,
      getItemSummary: (entry) => [entry.title, entry.year].filter(Boolean).join(" · ") || "Penghargaan",
      defaultItemProps: award("Nama penghargaan", "Pemberi", "2024", "award"),
      arrayFields: {
        title: { type: "text", label: "Nama penghargaan atau sertifikat" },
        issuer: { type: "text", label: "Pemberi" },
        year: { type: "text", label: "Tahun" },
        icon: iconField("Ikon (bila tanpa gambar)"),
        image: imageField("Gambar/logo (boleh kosong)"),
      },
    },
  },
  defaultProps: {
    eyebrow: "",
    title: "Penghargaan dan sertifikat",
    subtitle: "",
    variant: "badges",
    items: [
      award("UMKM Terbaik", "Pemerintah Kota", "2024", "trophy"),
      award("Sertifikat Halal", "BPJPH", "2023", "badge-check"),
      award("Izin Usaha (NIB)", "OSS", "2022", "file-check"),
      award("Pilihan Pelanggan", "Google", "2024", "star"),
    ],
  },
  render: (props) => <AwardsBlock {...props} />,
}
