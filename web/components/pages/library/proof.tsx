"use client"

import { useState, type ReactNode } from "react"
import type { ComponentConfig, PuckContext } from "@puckeditor/core"
import { QuoteIcon } from "lucide-react"
import { cn } from "cn"

import { IconTile } from "@/components/reui/icon-tile"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel"

import { BlockImage, hasText, Hint, orHint, Section, shownItems, textOf, useOverlayPortal, type BlockProps, type InlineText } from "../blocks"
import { itemField } from "../media-picker"
import { Marquee } from "../effects"
import { animateField, decimalsField, imageField, inline, introFields, layoutField, linkField, numberFormatField, showFields, sk, when, yesNoField } from "../fields"
import { iconField } from "../field-kit"
import { PageIcon } from "../page-icon"
import { migrateStat, StatNumber, statOf, type NumberFormat, type StatValue } from "../stat-number"
import { Buttons, columnsFor, Logo, Person, SectionIntro, Stars } from "./kit"

// Bukti dan kepercayaan: testimoni, logo mitra, angka capaian, ringkasan
// ulasan, dan penghargaan. Contoh bawaannya sengaja kosong: nama, ucapan,
// nilai, angka, dan penghargaan contoh akan terbit seolah fakta usaha ini.
// Di editor yang kosong ditandai petunjuk; pengunjung hanya melihat yang diisi.

const { t, s, i, c, a, o, p, w, intro, text } = sk

// --- Testimoni ---------------------------------------------------------------------------------

/**
 * Data lama tidak punya `image` dan `rating`: keduanya bisa tidak ada. Ucapan,
 * nama, dan peran bisa diketik langsung di kanvas (`InlineText`).
 */
type Testimonial = { quote: InlineText; name: InlineText; role: InlineText; image: string | null; rating: number }

export type TestimonialsProps = {
  eyebrow: InlineText
  title: InlineText
  subtitle: InlineText
  variant: "single" | "grid" | "marquee" | "tilt" | "carousel"
  stars: "yes" | "no"
  items: Testimonial[]
}

/**
 * Kolom dinding kartu menurut jumlahnya: empat kartu jadi 2×2, bukan 2-1-1,
 * dan satu atau dua kartu tidak terdampar di sisi kiri.
 */
function wallColumns(count: number): string {
  if (count <= 1) return "mx-auto max-w-xl"
  if (count === 2 || count === 4) return "mx-auto max-w-4xl sm:columns-2"
  return "sm:columns-2 lg:columns-3"
}

function TestimonialCard({ item, stars, puck, className }: { item: Testimonial; stars: boolean; puck: PuckContext; className?: string }) {
  const name = orHint(item.name, "Nama pelanggan", puck)
  const role = orHint(item.role, "Peran atau asal", puck)
  return (
    <figure className={cn("flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs", className)}>
      {stars && item.rating ? <Stars value={item.rating} /> : null}
      <blockquote className="text-sm text-pretty">{orHint(item.quote, "Tulis ucapan pelanggan", puck)}</blockquote>
      <figcaption className="mt-auto flex items-center gap-3">
        <Person name={textOf(item.name)} image={item.image} />
        {name || role ? (
          <div className="flex min-w-0 flex-col text-sm">
            {name ? <span className="truncate font-semibold">{name}</span> : null}
            {role ? <span className="truncate text-muted-foreground">{role}</span> : null}
          </div>
        ) : null}
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

function SingleQuote({ items, stars, puck }: { items: Testimonial[]; stars: boolean; puck: PuckContext }) {
  const [current, setCurrent] = useState(0)
  const portal = useOverlayPortal(puck)
  const item = items[Math.min(current, items.length - 1)]
  if (!item) return null
  const name = orHint(item.name, "Nama pelanggan", puck)
  const role = orHint(item.role, "Peran atau asal", puck)
  // Tanda kutip di slot sendiri, kosong atau tidak: ucapannya tetap di tempat
  // yang sama, jadi isian edit-langsung tidak dipasang ulang saat huruf pertama.
  const quoted = hasText(item.quote)
  return (
    <figure className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
      <QuoteIcon aria-hidden="true" className="size-8 text-muted-foreground/50" />
      {stars && item.rating ? <Stars value={item.rating} /> : null}
      <blockquote className="page-title text-2xl font-medium tracking-tight text-balance sm:text-3xl">
        {quoted ? "“" : null}
        {orHint(item.quote, "Tulis ucapan pelanggan", puck)}
        {quoted ? "”" : null}
      </blockquote>
      {name || role ? (
        <figcaption className="flex flex-col items-center gap-1">
          {name ? <span className="font-semibold">{name}</span> : null}
          {role ? <span className="text-sm text-muted-foreground">{role}</span> : null}
        </figcaption>
      ) : null}
      {items.length > 1 ? (
        // Foto pelanggan lain: diklik untuk berganti kutipan (juga di editor).
        <div role="group" aria-label="Pilih testimoni" className="flex gap-2">
          {items.map((entry, index) => (
            <button
              key={index}
              ref={portal}
              type="button"
              aria-label={hasText(entry.name) ? `Testimoni dari ${textOf(entry.name).trim()}` : `Testimoni ${index + 1}`}
              aria-pressed={index === current}
              onClick={() => setCurrent(index)}
              className={cn(
                "rounded-full ring-offset-2 ring-offset-background transition",
                index === current ? "ring-2 ring-primary" : "opacity-60 hover:opacity-100"
              )}
            >
              <Person name={textOf(entry.name)} image={entry.image} />
            </button>
          ))}
        </div>
      ) : null}
    </figure>
  )
}

export function TestimonialsBlock({ eyebrow, title, subtitle, variant, stars, items, puck }: BlockProps<TestimonialsProps>) {
  // Ucapan adalah isi bagian ini: tanpa satu pun, pengunjung tidak melihat judulnya saja.
  const shown = shownItems(items, (item) => hasText(item.quote), puck)
  if (shown.length === 0 && !puck.isEditing) return null
  const star = stars === "yes"
  let wall: ReactNode = null
  if (shown.length === 0) wall = null
  else if (variant === "single") wall = <SingleQuote items={shown} stars={star} puck={puck} />
  else if (variant === "carousel") {
    // Satu atau dua kartu mengisi lebarnya, bukan menyisakan tempat kosong di kanan.
    const basis = shown.length === 1 ? "basis-full" : shown.length === 2 ? "basis-[85%] sm:basis-1/2" : "basis-[85%] sm:basis-1/2 lg:basis-1/3"
    wall = (
      <Carousel opts={{ align: "start" }} className="relative">
        <CarouselContent>
          {shown.map((item, index) => (
            <CarouselItem key={index} className={basis}>
              <TestimonialCard item={item} stars={star} puck={puck} className="h-full" />
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
                <TestimonialCard key={index} item={item} stars={star} puck={puck} />
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
            <TestimonialCard key={index} item={item} stars={star} puck={puck} className="w-80" />
          ))}
        </Marquee>
        <Marquee seconds={seconds} reverse>
          {rotated(shown, Math.ceil(shown.length / 2)).map((item, index) => (
            <TestimonialCard key={index} item={item} stars={star} puck={puck} className="w-80" />
          ))}
        </Marquee>
      </div>
    )
  } else {
    wall = (
      <div className={cn("w-full columns-1 gap-4", wallColumns(shown.length))}>
        {shown.map((item, index) => (
          <TestimonialCard key={index} item={item} stars={star} puck={puck} className="mb-4 break-inside-avoid" />
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

/** Testimoni kosong: nama, ucapan, dan bintang contoh akan terbit seolah ucapan pelanggan sungguhan. */
const blankQuote = (): Testimonial => ({ quote: "", name: "", role: "", image: null, rating: 0 })

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
      getItemSummary: (item) => textOf(item.name) || (hasText(item.quote) ? "Tanpa nama" : "Belum diisi"),
      defaultItemProps: blankQuote(),
      arrayFields: {
        quote: inline({ type: "textarea", label: "Ucapan pelanggan" }),
        name: inline({ type: "text", label: "Nama pelanggan" }),
        role: inline({ type: "text", label: "Peran atau asal", placeholder: "Misalnya: pemilik usaha, pelanggan tetap" }),
        image: imageField("Foto pelanggan (kosong: avatar otomatis)"),
        rating: { type: "number", label: "Bintang dari pelanggan (1–5, 0: tanpa bintang)", min: 0, max: 5, step: 0.5 },
      },
    },
  },
  defaultProps: {
    eyebrow: "",
    title: "Kata pelanggan",
    subtitle: "",
    variant: "grid",
    stars: "yes",
    items: [blankQuote(), blankQuote(), blankQuote(), blankQuote()],
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

type Partner = LogosProps["items"][number]

/** Logo mitra; di editor, butir tanpa nama dan gambar ditandai petunjuk supaya tempatnya terlihat. */
function PartnerLogo({ item, grayscale, puck }: { item: Partner; grayscale: boolean; puck: PuckContext }) {
  if (!item.image && !item.name.trim()) {
    return puck.isEditing ? <Hint className="flex h-9 shrink-0 items-center whitespace-nowrap">Nama mitra atau logo</Hint> : null
  }
  return <Logo name={item.name} image={item.image} grayscale={grayscale} />
}

export function LogosBlock({ title, variant, grayscale, items, puck }: BlockProps<LogosProps>) {
  const logos = shownItems(items, (item) => Boolean(item.name.trim() || item.image), puck)
  // Kalimat pengantar tanpa logo tidak berarti apa-apa bagi pengunjung.
  if (logos.length === 0 && !puck.isEditing) return null
  const gray = grayscale === "yes"
  const list = logos.map((item, index) => <PartnerLogo key={index} item={item} grayscale={gray} puck={puck} />)
  return (
    <Section className="flex flex-col gap-8">
      {title ? <p className="text-center text-sm font-medium text-muted-foreground">{title}</p> : null}
      {variant === "marquee" ? (
        <Marquee seconds={Math.max(logos.length * 4, 20)} className="[--gap:3.5rem]">
          {list}
        </Marquee>
      ) : variant === "cards" ? (
        // Kotak selebar tetap yang dibungkus ke tengah: baris terakhir yang tak penuh tetap rapi, berapa pun jumlahnya.
        <ul className="flex flex-wrap justify-center gap-3">
          {logos.map((item, index) => (
            <li
              key={index}
              className="flex h-20 basis-[calc((100%-0.75rem)/2)] items-center justify-center rounded-xl border bg-card px-4 shadow-xs sm:basis-40"
            >
              <PartnerLogo item={item} grayscale={gray} puck={puck} />
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
      getItemSummary: (item) => item.name || (item.image ? "Logo tanpa nama" : "Belum diisi"),
      defaultItemProps: { name: "", image: null },
      arrayFields: { name: { type: "text", label: "Nama mitra (tampil bila tanpa gambar)" }, image: imageField("Gambar logo mitra") },
    },
  },
  defaultProps: {
    // Pengantar netral: "dipercaya banyak pelanggan" adalah klaim yang belum tentu benar.
    title: "Mitra kami",
    variant: "marquee",
    grayscale: "yes",
    // Nama mitra contoh akan terbit seolah mitra sungguhan: enam tempat kosong saja.
    items: Array.from({ length: 6 }, () => ({ name: "", image: null })),
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
  eyebrow: InlineText
  title: InlineText
  subtitle: InlineText
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

/** Petunjuk di kartu berwarna utama: warna redup bawaan `Hint` tidak terbaca di sana. */
function leadHint(value: string | undefined, hint: string, puck: PuckContext): ReactNode {
  if (value?.trim()) return value
  return puck.isEditing ? <Hint className="text-primary-foreground/70">{hint}</Hint> : null
}

/**
 * Bento: kartu besar (pertama) dan sisanya di kisi tiga kolom. Rentang kartu
 * dipilih menurut jumlah sisa supaya tidak ada petak kosong. Kartu besar
 * setinggi dua baris hanya bila ada minimal dua kartu di sampingnya.
 */
function bentoLead(rest: number): string {
  if (rest >= 2) return "md:row-span-2"
  return rest === 1 ? "md:col-span-2" : "md:col-span-3"
}

function bentoTile(index: number, rest: number): string | false {
  // Dua kartu: masing-masing selebar dua kolom, bertumpuk di samping kartu besar.
  if (rest === 2) return "md:col-span-2"
  // Tiga kartu: yang ketiga mengisi baris kedua di samping kartu besar.
  if (rest === 3) return index === 2 && "md:col-span-2"
  // Lebih dari empat: sisanya mengisi baris tiga kolom; kartu terakhir melebar menutup baris yang tak penuh.
  if (rest > 4 && index === rest - 1) {
    const lastRow = (rest - 4) % 3
    if (lastRow === 1) return "md:col-span-3"
    if (lastRow === 2) return "md:col-span-2"
  }
  return false
}

/**
 * Lebar butir angka (susunan polos dan kartu). Barisnya dibungkus dan butir
 * sisa berada di tengah, jadi jumlah berapa pun tidak menyisakan petak
 * kosong. Kelas Tailwind harus tertulis utuh.
 */
function statWidth(count: number): string {
  if (count <= 1) return "basis-full"
  const perRow = count <= 4 ? count : count <= 6 ? 3 : 4
  const wide = perRow === 3 ? "lg:basis-[calc((100%-2rem)/3)]" : perRow === 4 ? "lg:basis-[calc((100%-3rem)/4)]" : ""
  return cn("basis-[calc((100%-1rem)/2)]", wide)
}

export function StatsBlock(props: BlockProps<StatsProps>) {
  const { eyebrow, title, subtitle, style, items, image, puck } = props
  // Angka tanpa label tidak berarti apa-apa bagi pengunjung; tanpa satu pun, bagian ini tidak tampil.
  const shown = shownItems(items, (item) => item.label.trim() !== "", puck)
  if (shown.length === 0 && !puck.isEditing) return null
  const label = (item: StatItem) => orHint(item.label, "Label angka", puck)
  if (style === "bento") {
    const [first, ...rest] = shown
    return (
      <Section className="flex flex-col gap-12">
        <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
        <dl className="grid gap-4 md:auto-rows-fr md:grid-cols-3">
          {first ? (
            <div
              className={cn(
                "@container flex flex-col justify-end gap-2 rounded-2xl bg-primary p-8 text-primary-foreground",
                bentoLead(rest.length)
              )}
            >
              <StatFigure
                item={first}
                props={props}
                className="text-[min(4.5rem,22cqw)] leading-none font-semibold tracking-tight whitespace-nowrap tabular-nums"
              />
              <dt className="text-lg font-medium">{leadHint(first.label, "Label angka", puck)}</dt>
              {first.description?.trim() || puck.isEditing ? (
                <dd className="text-sm text-pretty opacity-80">{leadHint(first.description, "Penjelasan singkat", puck)}</dd>
              ) : null}
            </div>
          ) : null}
          {rest.map((item, index) => (
            <div key={index} className={cn("@container flex flex-col gap-1 rounded-2xl border bg-card p-6 shadow-xs", bentoTile(index, rest.length))}>
              <StatFigure item={item} props={props} className="text-[min(2.5rem,16cqw)] font-semibold tracking-tight whitespace-nowrap tabular-nums" />
              <dt className="font-medium">{label(item)}</dt>
              {item.description?.trim() ? <dd className="text-sm text-pretty text-muted-foreground">{item.description}</dd> : null}
            </div>
          ))}
        </dl>
      </Section>
    )
  }
  if (style === "image") {
    return (
      <Section className={cn("grid items-center gap-12", (image || puck.isEditing) && "lg:grid-cols-2")}>
        {image || puck.isEditing ? <BlockImage src={image} alt="" className="aspect-4/3 w-full rounded-2xl shadow-lg" puck={puck} field="image" /> : null}
        <div className="flex flex-col gap-10">
          <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} align="left" />
          <dl className="grid grid-cols-2 gap-x-8 gap-y-8">
            {shown.map((item, index) => (
              // Butir ganjil terakhir melebar supaya tidak ada petak kosong di sampingnya.
              <div
                key={index}
                className={cn(
                  "@container flex flex-col gap-1 border-l-2 border-primary pl-4",
                  shown.length % 2 === 1 && index === shown.length - 1 && "col-span-2"
                )}
              >
                <StatFigure item={item} props={props} className="text-[min(2.75rem,18cqw)] font-semibold tracking-tight whitespace-nowrap tabular-nums" />
                <dt className="text-sm text-muted-foreground">{label(item)}</dt>
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
      <dl className="flex flex-wrap justify-center gap-4">
        {shown.map((item, index) => (
          <div
            key={index}
            className={cn(
              "@container flex min-w-0 flex-col-reverse gap-1 text-center",
              statWidth(shown.length),
              style === "cards" && "rounded-xl border bg-card p-6 shadow-xs"
            )}
          >
            <dt className="text-sm text-muted-foreground">{label(item)}</dt>
            <dd>
              <StatFigure item={item} props={props} className="text-[min(3rem,15cqw)] font-semibold tracking-tight whitespace-nowrap tabular-nums" />
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

/** Angka kosong: angka contoh ("98% puas") akan terbit seolah capaian usaha ini. */
const blankStat = (): StatItem => ({ number: 0, prefix: "", suffix: "", label: "", description: "" })

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
      getItemSummary: (item) =>
        item.label.trim() ? `${item.prefix ?? ""}${item.number ?? item.value ?? ""}${item.suffix ?? ""} ${item.label}`.trim() : "Belum diisi",
      defaultItemProps: blankStat(),
      arrayFields: {
        number: { type: "number", label: "Angka" },
        prefix: { type: "text", label: "Awalan sebelum angka", placeholder: "Misalnya: ±" },
        suffix: { type: "text", label: "Akhiran sesudah angka", placeholder: "Misalnya: +, jam, pelanggan" },
        label: { type: "text", label: "Label angka" },
        description: { type: "textarea", label: "Penjelasan angka (untuk susunan bento)" },
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
    items: [blankStat(), blankStat(), blankStat(), blankStat()],
  },
  resolveData: ({ props }) => ({ props: { ...props, items: props.items.map(migrateStat) } }),
  render: (props) => <StatsBlock {...props} />,
}

// --- Ringkasan ulasan --------------------------------------------------------------------------

/** Nama dan isi ulasan bisa diketik langsung di kanvas; waktu ulasan tidak. */
type Review = { name: InlineText; rating: number; quote: InlineText; date: string }

export type ReviewsProps = {
  eyebrow: InlineText
  title: InlineText
  subtitle: InlineText
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

function ReviewCard({ review, puck }: { review: Review; puck: PuckContext }) {
  const name = orHint(review.name, "Nama pengulas", puck)
  const date = orHint(review.date, "Waktu ulasan", puck)
  return (
    <figure className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <Person name={textOf(review.name)} className="size-8" />
          {name ? <span className="text-sm font-semibold">{name}</span> : null}
        </span>
        {date ? <span className="text-xs text-muted-foreground">{date}</span> : null}
      </div>
      {/* Bintang nol berarti belum diisi, bukan nilai terburuk. */}
      {review.rating > 0 ? <Stars value={review.rating} /> : null}
      <blockquote className="text-sm text-pretty text-muted-foreground">{orHint(review.quote, "Tulis isi ulasan", puck)}</blockquote>
    </figure>
  )
}

/** Kolom kartu ulasan di bawah lencana (paling banyak tiga). */
function badgeColumns(count: number): string {
  if (count <= 1) return "max-w-xl"
  return count === 2 ? "max-w-4xl md:grid-cols-2" : "md:grid-cols-3"
}

export function ReviewsBlock(props: BlockProps<ReviewsProps>) {
  const { eyebrow, title, subtitle, variant, source, rating, items, puck } = props
  const counts = [props.star5, props.star4, props.star3, props.star2, props.star1].map((count) => Math.max(0, count || 0))
  const total = counts.reduce((sum, count) => sum + count, 0)
  // Nilai yang tampil selalu cocok dengan sebaran bintangnya; isian nilai rata-rata hanya dipakai bila sebarannya kosong.
  const average = total > 0 ? counts.reduce((sum, count, index) => sum + count * (5 - index), 0) / total : Math.max(0, Math.min(5, rating || 0))
  const reviews = shownItems(items, (review) => hasText(review.quote), puck)
  // Nilai nol berarti belum diisi: pengunjung tidak melihat ringkasan "0,0".
  const summary = average > 0 || puck.isEditing
  if (!summary && reviews.length === 0) return null

  const where = source?.trim() ?? ""
  let totalText = ""
  if (total > 0) totalText = `${total.toLocaleString("id-ID")} ulasan${where ? ` di ${where}` : ""}`
  else if (where) totalText = `Ulasan di ${where}`
  const totalNote = orHint(totalText, "Isi jumlah ulasan per bintang", puck)
  const ratingText = average.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const button = <Buttons primary={{ label: props.button_label, link: props.button_link }} align={variant === "badge" ? "center" : "left"} puck={puck} />

  if (variant === "badge") {
    const picked = reviews.slice(0, 3)
    return (
      <Section className="flex flex-col items-center gap-10">
        <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
        {summary ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card px-8 py-6 text-center shadow-sm">
            <span className="text-5xl font-semibold tracking-tight tabular-nums">{ratingText}</span>
            {average > 0 ? <Stars value={average} className="[&_svg]:size-5" /> : null}
            {totalNote ? <span className="text-sm text-muted-foreground">{totalNote}</span> : null}
          </div>
        ) : null}
        {picked.length > 0 ? (
          <div className={cn("grid w-full gap-4", badgeColumns(picked.length))}>
            {picked.map((review, index) => (
              <ReviewCard key={index} review={review} puck={puck} />
            ))}
          </div>
        ) : null}
        {button}
      </Section>
    )
  }

  const list =
    reviews.length > 0 ? (
      // Di samping ringkasan ruangnya sempit (paling banyak dua kolom); tanpa ringkasan, kolomnya mengikuti jumlah ulasan.
      <div className={cn("w-full columns-1 gap-4", summary ? reviews.length > 1 && "md:columns-2" : wallColumns(reviews.length))}>
        {reviews.map((review, index) => (
          <div key={index} className="mb-4 break-inside-avoid">
            <ReviewCard review={review} puck={puck} />
          </div>
        ))}
      </div>
    ) : null
  return (
    <Section className="flex flex-col gap-12">
      <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <div className={cn("grid items-start gap-8", summary && list && "lg:grid-cols-[20rem_1fr]")}>
        {summary ? (
          <div className={cn("flex flex-col gap-5 rounded-2xl border bg-card p-6 shadow-xs", !list && "mx-auto w-full max-w-sm")}>
            <div className="flex items-end gap-3">
              <span className="text-5xl leading-none font-semibold tracking-tight tabular-nums">{ratingText}</span>
              <div className="flex flex-col gap-1 pb-0.5">
                {average > 0 ? <Stars value={average} /> : null}
                {totalNote ? <span className="text-xs text-muted-foreground">{totalNote}</span> : null}
              </div>
            </div>
            {/* Sebaran bintang hanya bila jumlahnya diisi; di editor tetap tampil sebagai bentuk. */}
            {total > 0 || puck.isEditing ? (
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
            ) : null}
            {button}
          </div>
        ) : null}
        {list}
        {summary ? null : button}
      </div>
    </Section>
  )
}

const starField = (stars: number) => ({ type: "number", label: `Jumlah ulasan ${stars} bintang`, min: 0 }) as const

/** Ulasan kosong: nama, isi, dan nilai contoh akan terbit seolah ulasan sungguhan. */
const blankReview = (): Review => ({ name: "", rating: 0, quote: "", date: "" })

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
    source: { type: "text", label: "Sumber ulasan", placeholder: "Google, Tokopedia, Instagram…" },
    rating: { type: "number", label: "Nilai rata-rata 0–5 (dipakai bila jumlah ulasan per bintang kosong)", min: 0, max: 5, step: 0.1 },
    star5: starField(5),
    star4: starField(4),
    star3: starField(3),
    star2: starField(2),
    star1: starField(1),
    items: {
      type: "array",
      label: "Ulasan pilihan",
      max: 12,
      getItemSummary: (review) => textOf(review.name) || (hasText(review.quote) ? "Ulasan tanpa nama" : "Belum diisi"),
      defaultItemProps: blankReview(),
      arrayFields: {
        name: inline({ type: "text", label: "Nama pengulas" }),
        rating: { type: "number", label: "Bintang dari pengulas (1–5, 0: tanpa bintang)", min: 0, max: 5 },
        quote: inline({ type: "textarea", label: "Isi ulasan" }),
        date: { type: "text", label: "Waktu ulasan", placeholder: "2 minggu lalu" },
      },
    },
    button_label: { type: "text", label: "Teks tombol", placeholder: "Lihat semua ulasan" },
    button_link: linkField,
  },
  defaultProps: {
    eyebrow: "Ulasan",
    // Pengantar netral: "dinilai tinggi" adalah klaim yang belum tentu benar.
    title: "Apa kata pelanggan",
    subtitle: "",
    variant: "summary",
    source: "",
    rating: 0,
    star5: 0,
    star4: 0,
    star3: 0,
    star2: 0,
    star1: 0,
    items: [blankReview(), blankReview(), blankReview()],
    button_label: "",
    button_link: "",
  },
  render: (props) => <ReviewsBlock {...props} />,
}

// --- Penghargaan & sertifikat ------------------------------------------------------------------

/** Nama penghargaan dan pemberinya bisa diketik langsung di kanvas; tahunnya tidak. */
type Award = { icon: string; image: string | null; title: InlineText; issuer: InlineText; year: string }

export type AwardsProps = {
  eyebrow: InlineText
  title: InlineText
  subtitle: InlineText
  variant: "badges" | "cards" | "list"
  items: Award[]
}

function AwardMark({ award, puck, large, field }: { award: Award; puck: PuckContext; large?: boolean; field?: string }) {
  if (award.image)
    return (
      <BlockImage src={award.image} alt="" className={cn("shrink-0 rounded-full bg-background", large ? "size-24" : "size-12")} puck={puck} field={field} />
    )
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

/** Pemberi dan tahun dalam satu baris. Di editor yang kosong ditandai petunjuk; bagi pengunjung yang kosong dilewati. */
function awardSource(award: Award, puck: PuckContext): ReactNode {
  if (puck.isEditing) {
    return (
      <>
        {orHint(award.issuer, "Pemberi", puck)} · {orHint(award.year, "Tahun", puck)}
      </>
    )
  }
  return (
    [textOf(award.issuer), award.year]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" · ") || null
  )
}

export function AwardsBlock({ eyebrow, title, subtitle, variant, items, puck }: BlockProps<AwardsProps>) {
  // Penghargaan adalah isi bagian ini: tanpa satu pun, pengunjung tidak melihat judulnya saja.
  const awards = shownItems(items, (award) => hasText(award.title), puck)
  if (awards.length === 0 && !puck.isEditing) return null
  const awardTitle = (award: Award) => orHint(award.title, "Nama penghargaan", puck)
  let body
  if (variant === "cards") {
    body = (
      <ul className={cn("grid gap-4", columnsFor(awards.length), awards.length === 1 && "mx-auto w-full max-w-md")}>
        {awards.map((award, index) => {
          const source = awardSource(award, puck)
          return (
            <li key={index} className="flex items-start gap-4 rounded-2xl border bg-card p-5 shadow-xs">
              <AwardMark award={award} puck={puck} field={itemField("items", items, award)} />
              <div className="flex flex-col gap-1">
                <span className="font-semibold">{awardTitle(award)}</span>
                {source ? <span className="text-sm text-muted-foreground">{source}</span> : null}
              </div>
            </li>
          )
        })}
      </ul>
    )
  } else if (variant === "list") {
    // Kolom tahun hanya bila ada tahun yang diisi; di editor tetap tampil sebagai tempat isian.
    const years = puck.isEditing || awards.some((award) => award.year?.trim())
    body = (
      <ol className="mx-auto flex w-full max-w-3xl flex-col divide-y rounded-2xl border bg-card">
        {awards.map((award, index) => {
          const issuer = orHint(award.issuer, "Pemberi", puck)
          return (
            <li key={index} className="flex items-center gap-5 p-5">
              {years ? <span className="w-14 shrink-0 text-lg font-semibold text-muted-foreground tabular-nums">{orHint(award.year, "Tahun", puck)}</span> : null}
              <div className="flex flex-1 flex-col">
                <span className="font-semibold">{awardTitle(award)}</span>
                {issuer ? <span className="text-sm text-muted-foreground">{issuer}</span> : null}
              </div>
              <AwardMark award={award} puck={puck} field={itemField("items", items, award)} />
            </li>
          )
        })}
      </ol>
    )
  } else {
    body = (
      <ul className="flex flex-wrap justify-center gap-x-10 gap-y-8">
        {awards.map((award, index) => {
          const source = awardSource(award, puck)
          return (
            <li key={index} className="flex w-40 flex-col items-center gap-3 text-center">
              <span className="rounded-full border-4 border-muted p-1">
                <AwardMark award={award} puck={puck} large field={itemField("items", items, award)} />
              </span>
              <span className="text-sm font-semibold text-balance">{awardTitle(award)}</span>
              {source ? <span className="text-xs text-muted-foreground">{source}</span> : null}
            </li>
          )
        })}
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

/** Penghargaan kosong: nama, pemberi, dan tahun contoh akan terbit seolah penghargaan sungguhan. Ikonnya bukan fakta, jadi boleh beragam. */
const blankAward = (icon: string): Award => ({ icon, image: null, title: "", issuer: "", year: "" })

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
      getItemSummary: (entry) => [textOf(entry.title), entry.year].filter(Boolean).join(" · ") || "Belum diisi",
      defaultItemProps: blankAward("award"),
      arrayFields: {
        title: inline({ type: "text", label: "Nama penghargaan atau sertifikat" }),
        issuer: inline({ type: "text", label: "Pemberi penghargaan atau sertifikat" }),
        year: { type: "text", label: "Tahun diterima" },
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
    items: [blankAward("trophy"), blankAward("badge-check"), blankAward("medal"), blankAward("award")],
  },
  render: (props) => <AwardsBlock {...props} />,
}
