"use client"

import { useState, type ReactNode } from "react"
import type { ComponentConfig, PuckContext } from "@puckeditor/core"
import { ArrowRightIcon, CheckIcon, EyeIcon, TargetIcon } from "lucide-react"
import { cn } from "cn"

import { Badge } from "@/components/reui/badge"
import { IconTile } from "@/components/reui/icon-tile"

import {
  BlockImage,
  hasText,
  Hint,
  orHint,
  resolveLink,
  richText,
  Section,
  SectionTitle,
  shownItems,
  textOf,
  useOverlayPortal,
  type BlockProps,
  type InlineText,
} from "../blocks"
import { itemField } from "../media-picker"
import { Backdrop, EffectFrame, type CardEffect } from "../effects"
import { cardEffectOptions, imageField, inline, inlineRichText, introFields, layoutField, linkField, showFields, sk, when } from "../fields"
import { iconField } from "../field-kit"
import { PageIcon } from "../page-icon"
import { Buttons, cardColumns, columnsFor, lines, Person, SectionIntro } from "./kit"

// Isi halaman: fitur, layanan, gambar + teks, langkah, teks, tentang kami,
// tim, dan sejarah.
//
// Contoh bawaan di sini terbit apa adanya bila tidak disunting, dan AI
// penyusun halaman mengisi isian yang dilewatinya dari contoh ini. Karena itu
// contohnya tidak memuat fakta usaha (nama orang, tahun, jumlah, harga,
// jaminan): yang berupa fakta dibiarkan kosong dan ditandai petunjuk di editor.

const { t, s, b, i, c, a, o, p, intro, text } = sk

/**
 * Ada isinya: setidaknya satu teks tidak kosong. Data lama bisa tidak punya
 * sebagian isian, dan di editor isian edit-langsung berupa elemen, bukan string.
 */
function filled(...values: InlineText[]): boolean {
  return values.some((value) => hasText(value))
}

/** Daftar dua kolom; satu butir saja tidak perlu kolom kedua yang kosong. */
function listGrid(count: number): string {
  return count > 1 ? "md:grid-cols-2" : "mx-auto w-full max-w-2xl"
}

function FeatureIcon({ name, large }: { name: string; large?: boolean }) {
  return (
    <IconTile variant="solid" aria-hidden="true" className={cn(large && "size-14 rounded-2xl [&_svg]:size-6")}>
      <PageIcon name={name} />
    </IconTile>
  )
}

function Checklist({ items, className }: { items: { title: ReactNode; description?: ReactNode }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-4", className)}>
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-3">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <CheckIcon aria-hidden="true" className="size-3" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">{item.title}</span>
            {item.description ? <span className="text-sm text-pretty text-muted-foreground">{item.description}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Paragraf dari isian berbaris banyak: setiap baris satu paragraf. */
function Paragraphs({ text, hint, puck, className }: { text: string; hint: string; puck: PuckContext; className?: string }) {
  const paragraphs = lines(text)
  if (paragraphs.length === 0) {
    return puck.isEditing ? (
      <p className={className}>
        <Hint>{hint}</Hint>
      </p>
    ) : null
  }
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  )
}

// --- Fitur -------------------------------------------------------------------------------------

type FeatureItem = { icon: string; title: InlineText; description: InlineText; image: string | null }

export type FeaturesProps = {
  eyebrow: InlineText
  title: InlineText
  subtitle: InlineText
  layout: "grid" | "bento" | "list" | "icons" | "zigzag" | "tabs" | "checklist"
  card_effect: CardEffect
  image: string | null
  items: FeatureItem[]
}

/** Judul dan penjelasan satu fitur; yang kosong menjadi petunjuk di editor. */
function featureCopy(item: FeatureItem, puck: PuckContext) {
  return { title: orHint(item.title, "Judul keunggulan", puck), description: orHint(item.description, "Penjelasan singkat", puck) }
}

/**
 * Bento: kartu lebar dan sempit bergantian, dua per baris (2+1, lalu 1+2).
 * Jumlah ganjil menyisakan satu kartu sendirian di baris terakhir; ia dibuat
 * selebar baris supaya kisinya tidak berlubang.
 */
function bentoSpan(index: number, count: number): string {
  if (count % 2 === 1 && index === count - 1) return "md:col-span-3"
  return index % 4 === 0 || index % 4 === 3 ? "md:col-span-2" : ""
}

function FeatureTabs({ items, all, puck }: { items: FeatureItem[]; all: FeatureItem[]; puck: PuckContext }) {
  const [current, setCurrent] = useState(0)
  const portal = useOverlayPortal(puck)
  const active = items[Math.min(current, items.length - 1)]
  // Tanpa gambar sama sekali (halaman terbit), daftarnya selebar bagian.
  const pictures = puck.isEditing || items.some((item) => item.image)
  return (
    <div className={cn("grid items-center gap-8", pictures ? "lg:grid-cols-[1fr_1.4fr]" : "mx-auto w-full max-w-2xl")}>
      {/* Bisa diklik langsung di editor (overlay portal). */}
      <div role="tablist" aria-orientation="vertical" className="flex flex-col gap-2">
        {items.map((item, index) => {
          // Teks di dalam tombol tab tetap teks biasa: edit-langsung menelan kliknya, jadi tab tidak bisa dipilih. Diisi lewat panel.
          const copy = featureCopy({ ...item, title: textOf(item.title), description: textOf(item.description) }, puck)
          return (
            <button
              key={index}
              ref={portal}
              type="button"
              role="tab"
              aria-selected={index === current}
              onClick={() => setCurrent(index)}
              className={cn(
                "flex items-start gap-4 rounded-xl border p-4 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                index === current ? "border-primary bg-card shadow-sm" : "border-transparent hover:bg-muted"
              )}
            >
              <FeatureIcon name={item.icon} />
              <span className="flex flex-col gap-1">
                <span className="font-semibold">{copy.title}</span>
                {copy.description ? <span className="text-sm text-pretty text-muted-foreground">{copy.description}</span> : null}
              </span>
            </button>
          )
        })}
      </div>
      {active && pictures ? (
        <BlockImage key={current} src={active.image} alt="" className="aspect-4/3 w-full rounded-2xl shadow-lg" puck={puck} field={itemField("items", all, active)} />
      ) : null}
    </div>
  )
}

export function FeaturesBlock({ eyebrow, title, subtitle, layout, card_effect, image, items, puck }: BlockProps<FeaturesProps>) {
  const shown = shownItems(items, (item) => filled(item.title, item.description), puck)
  // Fitur adalah isi bagian ini: tanpa satu pun yang terisi, judulnya saja tidak berarti bagi pengunjung.
  if (shown.length === 0 && !puck.isEditing) return null
  const intro = <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
  if (layout === "checklist") {
    return (
      <Section className={cn("grid items-center gap-12", (image || puck.isEditing) && "lg:grid-cols-2")}>
        <div className="flex flex-col gap-8">
          <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} align="left" />
          <Checklist items={shown.map((item) => featureCopy(item, puck))} />
        </div>
        {image || puck.isEditing ? <BlockImage src={image} alt="" className="aspect-4/3 w-full rounded-2xl shadow-lg" puck={puck} field="image" /> : null}
      </Section>
    )
  }
  let body: ReactNode
  if (layout === "tabs") body = <FeatureTabs items={shown} all={items} puck={puck} />
  else if (layout === "zigzag") {
    body = (
      <ul className="flex flex-col gap-16">
        {shown.map((item, index) => {
          const copy = featureCopy(item, puck)
          // Tanpa gambar (halaman terbit) teksnya berdiri sendiri di tengah, bukan separuh baris yang kosong.
          const pictured = Boolean(item.image) || puck.isEditing
          return (
            <li key={index} className={cn("grid items-center gap-8 md:gap-14", pictured ? "md:grid-cols-2" : "mx-auto w-full max-w-2xl")}>
              {pictured ? (
                <BlockImage
                  src={item.image}
                  alt=""
                  className={cn("aspect-4/3 w-full rounded-2xl shadow-sm", index % 2 === 1 && "md:order-2")}
                  puck={puck}
                  field={itemField("items", items, item)}
                />
              ) : null}
              <div className="flex flex-col items-start gap-4">
                <FeatureIcon name={item.icon} />
                <h3 className="text-2xl font-semibold tracking-tight">{copy.title}</h3>
                {copy.description ? <p className="text-lg text-pretty text-muted-foreground">{copy.description}</p> : null}
              </div>
            </li>
          )
        })}
      </ul>
    )
  } else if (layout === "icons") {
    body = (
      <ul className={cn("grid gap-x-8 gap-y-12", columnsFor(shown.length))}>
        {shown.map((item, index) => {
          const copy = featureCopy(item, puck)
          return (
            <li key={index} className="flex flex-col items-center gap-4 text-center">
              <FeatureIcon name={item.icon} large />
              <h3 className="text-lg font-semibold">{copy.title}</h3>
              {copy.description ? <p className="max-w-xs text-pretty text-muted-foreground">{copy.description}</p> : null}
            </li>
          )
        })}
      </ul>
    )
  } else if (layout === "list") {
    body = (
      <ul className={cn("grid gap-x-12 gap-y-8", listGrid(shown.length))}>
        {shown.map((item, index) => {
          const copy = featureCopy(item, puck)
          return (
            <li key={index} className="flex items-start gap-4">
              <FeatureIcon name={item.icon} />
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold">{copy.title}</h3>
                {copy.description ? <p className="text-pretty text-muted-foreground">{copy.description}</p> : null}
              </div>
            </li>
          )
        })}
      </ul>
    )
  } else {
    const bento = layout === "bento"
    body = (
      <ul className={cn("grid gap-4", bento ? "md:auto-rows-[minmax(13rem,auto)] md:grid-cols-3" : cardColumns(shown.length))}>
        {shown.map((item, index) => {
          const copy = featureCopy(item, puck)
          return (
            <li key={index} className={cn("flex", bento && bentoSpan(index, shown.length))}>
              <EffectFrame effect={card_effect} className="flex flex-1 rounded-xl">
                <div className={cn("relative isolate flex flex-1 flex-col gap-4 overflow-hidden rounded-xl border bg-card p-6 shadow-xs", bento && "justify-end")}>
                  {bento ? <Backdrop kind="dots" /> : null}
                  <FeatureIcon name={item.icon} />
                  <div className="flex flex-col gap-1">
                    <h3 className="font-semibold">{copy.title}</h3>
                    {copy.description ? <p className="text-sm text-pretty text-muted-foreground">{copy.description}</p> : null}
                  </div>
                </div>
              </EffectFrame>
            </li>
          )
        })}
      </ul>
    )
  }
  return (
    <Section className="flex flex-col gap-12">
      {intro}
      {body}
    </Section>
  )
}

const feature = (icon: string, title: string, description: string): FeatureItem => ({ icon, title, description, image: null })

export const featuresConfig: ComponentConfig<FeaturesProps> = {
  label: "Fitur",
  fields: {
    layout: layoutField<FeaturesProps["layout"]>(
      "Susunan",
      [
        {
          value: "grid",
          label: "Kartu",
          sketch: [...intro(30, 2, 22), c(5, 10, 15, 10), c(22.5, 10, 15, 10), c(40, 10, 15, 10), c(5, 22, 15, 10), c(22.5, 22, 15, 10), c(40, 22, 15, 10)],
        },
        { value: "bento", label: "Bento", sketch: [...intro(30, 2, 22), c(5, 10, 32, 11), c(39, 10, 16, 11), c(5, 23, 16, 10), c(23, 23, 32, 10)] },
        {
          value: "list",
          label: "Daftar",
          sketch: [
            ...intro(30, 2, 22),
            o(6, 11, 4),
            t(12, 11.5, 14),
            s(12, 15, 16),
            o(32, 11, 4),
            t(38, 11.5, 14),
            s(38, 15, 16),
            o(6, 22, 4),
            t(12, 22.5, 14),
            s(12, 26, 16),
            o(32, 22, 4),
            t(38, 22.5, 14),
            s(38, 26, 16),
          ],
        },
        {
          value: "icons",
          label: "Ikon besar",
          sketch: [
            ...intro(30, 2, 22),
            o(10, 12, 7),
            t(8, 22, 11),
            s(8, 26, 11),
            o(26.5, 12, 7),
            t(24.5, 22, 11),
            s(24.5, 26, 11),
            o(43, 12, 7),
            t(41, 22, 11),
            s(41, 26, 11),
          ],
        },
        {
          value: "zigzag",
          label: "Selang-seling",
          sketch: [i(4, 3, 24, 14), o(32, 4, 4), t(32, 9.5, 18), s(32, 13.5, 22), i(32, 19, 24, 14), o(4, 20, 4), t(4, 25.5, 18), s(4, 29.5, 22)],
        },
        {
          value: "tabs",
          label: "Tab dengan gambar",
          sketch: [...intro(30, 1, 22), c(4, 9, 20, 7), s(10, 11.5, 12), s(10, 19.5, 12), s(10, 27, 12), o(6, 18, 3), o(6, 25.5, 3), i(28, 9, 28, 24)],
        },
        {
          value: "checklist",
          label: "Daftar centang + gambar",
          sketch: [
            ...text(4, 4, 20),
            a(4, 15, 2.4, 2.4),
            s(8, 15.5, 16),
            a(4, 20, 2.4, 2.4),
            s(8, 20.5, 16),
            a(4, 25, 2.4, 2.4),
            s(8, 25.5, 16),
            i(32, 5, 24, 26),
          ],
        },
      ],
      2
    ),
    ...introFields,
    card_effect: { type: "select", label: "Efek kartu", options: cardEffectOptions },
    image: imageField("Gambar di samping daftar centang"),
    items: {
      type: "array",
      label: "Fitur",
      max: 12,
      getItemSummary: (item) => textOf(item.title) || "Fitur tanpa nama",
      // Isian edit-langsung harus ada di butir baru (walau kosong), kalau tidak Puck tidak memasang tempat mengetiknya.
      defaultItemProps: feature("sparkles", "", ""),
      arrayFields: {
        icon: iconField("Ikon"),
        title: inline({ type: "text", label: "Judul" } as const),
        description: inline({ type: "textarea", label: "Penjelasan" } as const),
        image: imageField("Gambar (untuk susunan selang-seling dan tab)"),
      },
    },
  },
  resolveFields: showFields<FeaturesProps>({
    card_effect: when("layout", "grid", "bento"),
    image: when("layout", "checklist"),
  }),
  defaultProps: {
    eyebrow: "Keunggulan",
    title: "Kenapa memilih kami",
    subtitle: "Hal-hal yang kami jaga untuk setiap pelanggan.",
    layout: "grid",
    card_effect: "none",
    image: null,
    // Keunggulan umum tanpa angka, harga, atau jaminan: tidak ada yang bisa keliru tentang usaha mana pun.
    items: [
      feature("sparkles", "Pengerjaan rapi", "Setiap pekerjaan dicek ulang sebelum diserahkan."),
      feature("wallet", "Biaya terbuka", "Rincian biaya dijelaskan sebelum Anda memutuskan."),
      feature("headset", "Mudah dihubungi", "Pertanyaan Anda dijawab dengan jelas dan ramah."),
      feature("shield-check", "Dapat dipercaya", "Yang kami sampaikan, itu yang kami kerjakan."),
      feature("clock", "Tepat waktu", "Jadwal yang sudah disepakati kami jaga."),
      feature("heart", "Sepenuh hati", "Kebutuhan setiap pelanggan kami dengarkan dulu."),
    ],
  },
  render: (props) => <FeaturesBlock {...props} />,
}

// --- Layanan -----------------------------------------------------------------------------------

/** Data lama hanya punya title, description, dan icon. */
type Service = { title: InlineText; description: InlineText; icon: string; price?: string; image: string | null; link?: string }

export type ServicesProps = {
  eyebrow: InlineText
  title: InlineText
  subtitle: InlineText
  variant: "cards" | "price" | "list" | "images"
  price_prefix: string
  link_label: string
  items: Service[]
}

function ServiceLink({ service, label, puck }: { service: Service; label: string; puck: PuckContext }) {
  const target = resolveLink(service.link ?? "", puck)
  if (!target || !label) return null
  return (
    <a href={puck.isEditing ? undefined : target} className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
      {label}
      <ArrowRightIcon aria-hidden="true" className="size-3.5" />
    </a>
  )
}

export function ServicesBlock({ eyebrow, title, subtitle, variant, price_prefix, link_label, items, puck }: BlockProps<ServicesProps>) {
  const services = shownItems(items, (service) => filled(service.title), puck)
  // Layanan adalah isi bagian ini: tanpa satu pun yang bernama, bagian ini tidak ditampilkan.
  if (services.length === 0 && !puck.isEditing) return null
  const price = (service: Service) => {
    const amount = orHint(service.price, "Harga", puck)
    if (!amount) return null
    return (
      <span className="text-sm">
        {filled(price_prefix) ? <span className="text-muted-foreground">{price_prefix} </span> : null}
        <span className="font-semibold tabular-nums">{amount}</span>
      </span>
    )
  }
  const copy = (service: Service) => ({
    title: orHint(service.title, "Nama layanan", puck),
    description: orHint(service.description, "Penjelasan singkat", puck),
  })
  let body: ReactNode
  if (variant === "list") {
    body = (
      <ul className="mx-auto flex w-full max-w-4xl flex-col divide-y rounded-2xl border bg-card">
        {services.map((service, index) => {
          const text = copy(service)
          return (
            <li key={index} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
              <FeatureIcon name={service.icon} />
              <div className="flex flex-1 flex-col gap-1">
                <h3 className="font-semibold">{text.title}</h3>
                {text.description ? <p className="text-sm text-pretty text-muted-foreground">{text.description}</p> : null}
              </div>
              <div className="flex flex-col gap-1 sm:items-end">
                {price(service)}
                <ServiceLink service={service} label={link_label} puck={puck} />
              </div>
            </li>
          )
        })}
      </ul>
    )
  } else {
    body = (
      <ul className={cn("grid gap-4", cardColumns(services.length))}>
        {services.map((service, index) => {
          const text = copy(service)
          // Kartu berfoto yang fotonya kosong (halaman terbit) memakai ikon, supaya kartunya tetap punya penanda.
          const pictured = variant === "images" && (Boolean(service.image) || puck.isEditing)
          return (
            <li key={index} className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs">
              {pictured ? (
                <BlockImage
                  src={service.image ?? null}
                  alt=""
                  className="aspect-4/3 w-full rounded-none border-0 border-b"
                  puck={puck}
                  field={itemField("items", items, service)}
                />
              ) : null}
              <div className="flex flex-1 flex-col gap-4 p-5">
                {pictured ? null : <FeatureIcon name={service.icon} />}
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold">{text.title}</h3>
                  {text.description ? <p className="text-sm text-pretty text-muted-foreground">{text.description}</p> : null}
                </div>
                {variant === "price" || variant === "images" ? (
                  <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4">
                    {price(service) ?? <span />}
                    <ServiceLink service={service} label={link_label} puck={puck} />
                  </div>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    )
  }
  return (
    <Section className="flex flex-col gap-10">
      <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
      {body}
    </Section>
  )
}

const service = (icon: string, title: string, description: string, price: string): Service => ({
  icon,
  title,
  description,
  price,
  image: null,
  link: "#kontak",
})

export const servicesConfig: ComponentConfig<ServicesProps> = {
  label: "Layanan",
  fields: {
    variant: layoutField<ServicesProps["variant"]>("Susunan", [
      {
        value: "cards",
        label: "Kartu ikon",
        sketch: [
          ...intro(30, 2, 22),
          c(5, 10, 15, 22),
          o(7, 12, 5),
          t(7, 20, 9),
          s(7, 24, 11),
          c(22.5, 10, 15, 22),
          o(24.5, 12, 5),
          t(24.5, 20, 9),
          c(40, 10, 15, 22),
          o(42, 12, 5),
          t(42, 20, 9),
        ],
      },
      {
        value: "price",
        label: "Kartu dengan harga",
        sketch: [
          ...intro(30, 2, 22),
          c(5, 10, 15, 22),
          o(7, 12, 5),
          t(7, 19, 9),
          a(7, 27, 6, 2),
          c(22.5, 10, 15, 22),
          o(24.5, 12, 5),
          t(24.5, 19, 9),
          a(24.5, 27, 6, 2),
          c(40, 10, 15, 22),
          o(42, 12, 5),
          t(42, 19, 9),
          a(42, 27, 6, 2),
        ],
      },
      {
        value: "list",
        label: "Daftar",
        sketch: [
          ...intro(30, 2, 22),
          c(8, 10, 44, 23),
          o(10, 12, 4),
          t(16, 12.5, 16),
          a(44, 12.5, 6, 1.6),
          o(10, 19.5, 4),
          t(16, 20, 16),
          a(44, 20, 6, 1.6),
          o(10, 27, 4),
          t(16, 27.5, 16),
          a(44, 27.5, 6, 1.6),
        ],
      },
      {
        value: "images",
        label: "Kartu berfoto",
        sketch: [
          ...intro(30, 2, 22),
          c(5, 10, 15, 22),
          i(5, 10, 15, 10),
          t(7, 23, 9),
          a(7, 28, 6, 2),
          c(22.5, 10, 15, 22),
          i(22.5, 10, 15, 10),
          t(24.5, 23, 9),
          c(40, 10, 15, 22),
          i(40, 10, 15, 10),
          t(42, 23, 9),
        ],
      },
    ]),
    ...introFields,
    price_prefix: { type: "text", label: "Kata sebelum harga", placeholder: "Mulai" },
    link_label: { type: "text", label: "Teks tautan di setiap layanan", placeholder: "Pesan" },
    items: {
      type: "array",
      label: "Daftar layanan",
      max: 12,
      getItemSummary: (item) => textOf(item.title) || "Layanan tanpa nama",
      defaultItemProps: service("package", "", "", ""),
      // Harga dan tautan diisi lewat panel: petunjuk penulisan harga (Rp) hanya ada di sana, dan tautan bukan teks yang dibaca pengunjung.
      arrayFields: {
        title: inline({ type: "text", label: "Nama layanan" } as const),
        description: inline({ type: "textarea", label: "Penjelasan" } as const),
        icon: iconField("Ikon"),
        price: { type: "text", label: "Harga", placeholder: "Tulis dengan Rp; kosongkan bila tidak ditampilkan" },
        image: imageField("Foto (untuk kartu berfoto)"),
        link: { ...linkField, label: "Tautan layanan (boleh kosong)" },
      },
    },
  },
  resolveFields: showFields<ServicesProps>({
    price_prefix: (props) => props.variant !== "cards",
    link_label: (props) => props.variant !== "cards",
  }),
  defaultProps: {
    eyebrow: "",
    title: "Layanan kami",
    subtitle: "",
    variant: "cards",
    price_prefix: "Mulai",
    link_label: "Pesan",
    // Apa yang dijual dan berapa harganya adalah fakta usaha: dibiarkan kosong, editor menampilkan petunjuknya.
    items: [service("package", "", "", ""), service("sparkles", "", "", ""), service("handshake", "", "", "")],
  },
  render: (props) => <ServicesBlock {...props} />,
}

// --- Gambar + teks -----------------------------------------------------------------------------

export type ImageTextProps = {
  variant: "split" | "wide" | "points" | "numbers"
  eyebrow: InlineText
  title: InlineText
  /** Teks biasa (tidak diurai per baris), jadi boleh diketik langsung; baris barunya tetap tampil. */
  body: InlineText
  image: string | null
  image_position: "left" | "right"
  points: string
  stats: { value: string; label: string }[]
  button_label: string
  button_link: string
}

export function ImageTextBlock(props: BlockProps<ImageTextProps>) {
  const { variant, eyebrow, title, body, image, image_position, points, stats, puck } = props
  const pointLines = lines(points)
  const shownStats = shownItems(stats, (stat) => filled(stat.value), puck)
  const extras = (variant === "points" && pointLines.length > 0) || (variant === "numbers" && shownStats.length > 0)
  // Tanpa teks dan tanpa gambar, bagian ini hanya jarak kosong bagi pengunjung.
  if (!puck.isEditing && !image && !filled(eyebrow, title, body) && !extras) return null
  const heading = orHint(title, "Judul", puck)
  const lead = orHint(body, "Isi", puck)
  const copy = (center: boolean) => (
    <div className={cn("flex flex-col gap-5", center ? "items-center text-center" : "items-start")}>
      {filled(eyebrow) ? (
        <Badge variant="outline" radius="full">
          {eyebrow}
        </Badge>
      ) : null}
      {heading ? <SectionTitle>{heading}</SectionTitle> : null}
      {/* Baris baru yang diketik pengelola dipertahankan. */}
      {lead ? <p className={cn("page-lead text-lg whitespace-pre-line text-pretty text-muted-foreground", center && "max-w-2xl")}>{lead}</p> : null}
      {variant === "points" && pointLines.length > 0 ? <Checklist items={pointLines.map((line) => ({ title: line }))} /> : null}
      {variant === "points" && pointLines.length === 0 && puck.isEditing ? <Hint>Poin, satu per baris</Hint> : null}
      {variant === "numbers" && shownStats.length > 0 ? (
        <dl className="flex flex-wrap gap-x-10 gap-y-4 pt-2">
          {shownStats.map((stat, index) => (
            <div key={index} className="flex flex-col-reverse gap-1">
              <dt className="text-sm text-muted-foreground">{orHint(stat.label, "Label angka", puck)}</dt>
              <dd className="text-3xl font-semibold tracking-tight tabular-nums">{orHint(stat.value, "Angka", puck)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <Buttons primary={{ label: props.button_label, link: props.button_link }} align={center ? "center" : "left"} puck={puck} />
    </div>
  )
  // Tanpa gambar (halaman terbit) teksnya satu kolom, bukan separuh bagian yang kosong.
  const showImage = Boolean(image) || puck.isEditing
  if (variant === "wide") {
    return (
      <Section className="flex flex-col gap-10">
        {copy(true)}
        {showImage ? (
          <BlockImage src={image} alt={textOf(title)} className="aspect-video w-full rounded-3xl shadow-lg md:aspect-21/9" puck={puck} field="image" />
        ) : null}
      </Section>
    )
  }
  return (
    <Section className={cn("grid items-center gap-10 lg:gap-16", showImage ? "md:grid-cols-2" : "max-w-3xl")}>
      {showImage ? (
        <BlockImage
          src={image}
          alt={textOf(title)}
          className={cn("aspect-4/3 w-full rounded-2xl", image_position === "right" && "md:order-2")}
          puck={puck}
          field="image"
        />
      ) : null}
      {copy(false)}
    </Section>
  )
}

export const imageTextConfig: ComponentConfig<ImageTextProps> = {
  label: "Gambar + teks",
  fields: {
    variant: layoutField<ImageTextProps["variant"]>("Susunan", [
      { value: "split", label: "Berdampingan", sketch: [i(4, 5, 26, 26), ...text(34, 10, 20), b(34, 21)] },
      { value: "wide", label: "Gambar lebar", sketch: [...intro(30, 2, 28), i(4, 11, 52, 22)] },
      {
        value: "points",
        label: "Dengan poin",
        sketch: [
          i(4, 5, 26, 26),
          ...text(34, 5, 20),
          a(34, 15, 2.4, 2.4),
          s(38, 15.5, 16),
          a(34, 20, 2.4, 2.4),
          s(38, 20.5, 16),
          a(34, 25, 2.4, 2.4),
          s(38, 25.5, 16),
        ],
      },
      { value: "numbers", label: "Dengan angka", sketch: [i(4, 5, 26, 26), ...text(34, 6, 20), t(34, 19, 7), s(34, 23, 7), t(45, 19, 7), s(45, 23, 7)] },
    ]),
    image: imageField("Gambar"),
    image_position: {
      type: "radio",
      label: "Letak gambar",
      options: [
        { label: "Kiri", value: "left" },
        { label: "Kanan", value: "right" },
      ],
    },
    eyebrow: introFields.eyebrow,
    title: inline({ type: "text", label: "Judul" } as const),
    body: inline({ type: "textarea", label: "Isi" } as const),
    // Poin diurai per baris, jadi hanya lewat panel.
    points: { type: "textarea", label: "Poin (satu per baris)" },
    stats: {
      type: "array",
      label: "Angka",
      max: 4,
      getItemSummary: (stat) => [stat.value, stat.label].filter(Boolean).join(" ") || "Angka",
      defaultItemProps: { value: "", label: "" },
      arrayFields: { value: { type: "text", label: "Angka", placeholder: "Angka yang benar beserta satuannya" }, label: { type: "text", label: "Label di bawah angka" } },
    },
    button_label: { type: "text", label: "Teks tombol", placeholder: "Kosongkan bila tanpa tombol" },
    button_link: linkField,
  },
  resolveFields: showFields<ImageTextProps>({
    image_position: when("variant", "split", "points", "numbers"),
    points: when("variant", "points"),
    stats: when("variant", "numbers"),
  }),
  defaultProps: {
    variant: "split",
    eyebrow: "",
    title: "Perhatian pada setiap detail",
    body: "Dari pertanyaan pertama sampai produk atau layanan diterima, setiap langkah kami jalani dengan teliti.",
    image: null,
    image_position: "left",
    points: "Penjelasan yang jelas sejak awal\nPengerjaan yang teliti\nMudah dihubungi bila ada pertanyaan",
    // Angka adalah fakta usaha: kosong sampai diisi pengelola.
    stats: [
      { value: "", label: "" },
      { value: "", label: "" },
      { value: "", label: "" },
    ],
    button_label: "",
    button_link: "",
  },
  render: (props) => <ImageTextBlock {...props} />,
}

// --- Langkah -----------------------------------------------------------------------------------

/** Data lama tanpa `image`. */
type Step = { title: InlineText; description: InlineText; image: string | null }

export type StepsProps = {
  eyebrow: InlineText
  title: InlineText
  subtitle: InlineText
  variant: "row" | "vertical" | "cards"
  items: Step[]
}

export function StepsBlock({ eyebrow, title, subtitle, variant, items, puck }: BlockProps<StepsProps>) {
  const steps = shownItems(items, (item) => filled(item.title, item.description), puck)
  // Langkah adalah isi bagian ini: tanpa satu pun yang terisi, bagian ini tidak ditampilkan.
  if (steps.length === 0 && !puck.isEditing) return null
  const copy = (item: Step) => ({ title: orHint(item.title, "Judul langkah", puck), description: orHint(item.description, "Penjelasan singkat", puck) })
  const number = (index: number, className?: string) => (
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full border bg-background font-semibold tabular-nums shadow-xs", className)}>
      {index + 1}
    </span>
  )
  let body: ReactNode
  if (variant === "vertical") {
    body = (
      <ol className="mx-auto flex w-full max-w-2xl flex-col">
        {steps.map((item, index) => {
          const text = copy(item)
          return (
            <li key={index} className="relative flex gap-5 pb-10 last:pb-0">
              {index < steps.length - 1 ? <span aria-hidden="true" className="absolute top-12 bottom-2 left-5 w-px bg-border" /> : null}
              {number(index, "bg-primary text-primary-foreground border-transparent")}
              <div className="flex flex-col gap-1 pt-1.5">
                <h3 className="text-lg font-semibold">{text.title}</h3>
                {text.description ? <p className="text-pretty text-muted-foreground">{text.description}</p> : null}
              </div>
            </li>
          )
        })}
      </ol>
    )
  } else if (variant === "cards") {
    body = (
      <ol className={cn("grid gap-6", cardColumns(steps.length))}>
        {steps.map((item, index) => {
          const text = copy(item)
          // Di atas foto nomornya menempel di pojok; tanpa foto (halaman terbit) nomornya di atas judul, tidak menimpa teks.
          const pictured = Boolean(item.image) || puck.isEditing
          return (
            <li key={index} className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs">
              {pictured ? (
                <div className="relative">
                  <BlockImage
                    src={item.image ?? null}
                    alt=""
                    className="aspect-4/3 w-full rounded-none border-0 border-b"
                    puck={puck}
                    field={itemField("items", items, item)}
                  />
                  {number(index, "absolute top-3 left-3")}
                </div>
              ) : null}
              <div className="flex flex-col gap-1 p-5">
                {pictured ? null : number(index, "mb-3")}
                <h3 className="font-semibold">{text.title}</h3>
                {text.description ? <p className="text-sm text-pretty text-muted-foreground">{text.description}</p> : null}
              </div>
            </li>
          )
        })}
      </ol>
    )
  } else {
    body = (
      <ol className={cn("grid gap-8", columnsFor(steps.length))}>
        {steps.map((item, index) => {
          const text = copy(item)
          return (
            <li key={index} className="relative flex flex-col gap-3">
              {/* Garis penghubung ke langkah berikutnya, hanya bila berjajar. */}
              {index < steps.length - 1 ? <span aria-hidden="true" className="absolute top-5 right-0 left-14 hidden h-px bg-border md:block" /> : null}
              {number(index)}
              <h3 className="font-semibold">{text.title}</h3>
              {text.description ? <p className="text-pretty text-muted-foreground">{text.description}</p> : null}
            </li>
          )
        })}
      </ol>
    )
  }
  return (
    <Section className="flex flex-col gap-12">
      <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
      {body}
    </Section>
  )
}

export const stepsConfig: ComponentConfig<StepsProps> = {
  label: "Langkah",
  fields: {
    variant: layoutField<StepsProps["variant"]>("Susunan", [
      {
        value: "row",
        label: "Berjajar",
        sketch: [
          ...intro(30, 3),
          o(5, 14, 5),
          a(11, 16.2, 10, 0.6),
          t(5, 22, 10),
          s(5, 26, 13),
          o(23, 14, 5),
          a(29, 16.2, 10, 0.6),
          t(23, 22, 10),
          s(23, 26, 13),
          o(41, 14, 5),
          t(41, 22, 10),
          s(41, 26, 13),
        ],
      },
      {
        value: "vertical",
        label: "Bersusun dengan garis",
        sketch: [
          p(18, 3, 5, 5),
          a(20.2, 8, 0.6, 7),
          p(18, 15, 5, 5),
          a(20.2, 20, 0.6, 7),
          p(18, 27, 5, 5),
          t(26, 4, 14),
          s(26, 7.5, 18),
          t(26, 16, 14),
          s(26, 19.5, 18),
          t(26, 28, 14),
          s(26, 31.5, 18),
        ],
      },
      {
        value: "cards",
        label: "Kartu berfoto",
        sketch: [
          ...intro(30, 2, 22),
          c(5, 10, 15, 22),
          i(5, 10, 15, 11),
          o(6.5, 11.5, 4),
          t(7, 24, 9),
          c(22.5, 10, 15, 22),
          i(22.5, 10, 15, 11),
          o(24, 11.5, 4),
          t(24.5, 24, 9),
          c(40, 10, 15, 22),
          i(40, 10, 15, 11),
          o(41.5, 11.5, 4),
          t(42, 24, 9),
        ],
      },
    ]),
    ...introFields,
    items: {
      type: "array",
      label: "Langkah",
      max: 8,
      getItemSummary: (item, index) => textOf(item.title) || `Langkah ${(index ?? 0) + 1}`,
      defaultItemProps: { title: "", description: "", image: null },
      arrayFields: {
        title: inline({ type: "text", label: "Judul" } as const),
        description: inline({ type: "textarea", label: "Penjelasan" } as const),
        image: imageField("Foto (untuk kartu berfoto)"),
      },
    },
  },
  defaultProps: {
    eyebrow: "Cara kerja",
    title: "Mudah dari awal sampai selesai",
    subtitle: "",
    variant: "row",
    items: [
      { title: "Hubungi kami", description: "Ceritakan apa yang Anda butuhkan.", image: null },
      { title: "Sepakati rinciannya", description: "Pilihan, biaya, dan jadwal dibahas sebelum mulai.", image: null },
      { title: "Terima hasilnya", description: "Produk atau layanan Anda siap sesuai kesepakatan.", image: null },
    ],
  },
  render: (props) => <StepsBlock {...props} />,
}

// --- Teks --------------------------------------------------------------------------------------

export type TextProps = { variant: "single" | "columns" | "side"; eyebrow: InlineText; title: InlineText; body: ReactNode }

export function TextBlock({ variant, eyebrow, title, body, puck }: BlockProps<TextProps>) {
  const heading = orHint(title, "Judul", puck)
  const head =
    filled(eyebrow) || heading ? (
      <div className="flex flex-col items-start gap-3">
        {filled(eyebrow) ? (
          <Badge variant="outline" radius="full">
            {eyebrow}
          </Badge>
        ) : null}
        {heading ? <SectionTitle>{heading}</SectionTitle> : null}
      </div>
    ) : null
  if (variant === "side") {
    // Tanpa judul, kolom kirinya kosong: isinya dibuat satu kolom saja.
    return (
      <Section className={cn("grid gap-8 md:gap-16", head ? "md:grid-cols-[1fr_2fr]" : "max-w-3xl")}>
        {head}
        <div className={cn(richText, "page-lead text-lg text-muted-foreground")}>{body}</div>
      </Section>
    )
  }
  return (
    <Section className={cn(variant === "columns" ? "" : "max-w-3xl")}>
      <div className="flex flex-col gap-6">
        {head}
        <div
          className={cn(
            variant === "columns" ? "gap-12 md:columns-2 [&_p]:mb-4 [&_p]:break-inside-avoid" : richText,
            "page-lead text-lg text-muted-foreground"
          )}
        >
          {body}
        </div>
      </div>
    </Section>
  )
}

export const textConfig: ComponentConfig<TextProps> = {
  label: "Teks",
  fields: {
    variant: layoutField<TextProps["variant"]>("Susunan", [
      {
        value: "single",
        label: "Satu kolom",
        sketch: [t(14, 5, 22), s(14, 11, 32), s(14, 14, 30), s(14, 17, 32), s(14, 20, 26), s(14, 25, 32), s(14, 28, 22)],
      },
      {
        value: "columns",
        label: "Dua kolom",
        sketch: [t(4, 5, 22), s(4, 12, 24), s(4, 15, 22), s(4, 18, 24), s(4, 21, 20), s(32, 12, 24), s(32, 15, 22), s(32, 18, 24), s(32, 21, 16)],
      },
      {
        value: "side",
        label: "Judul di samping",
        sketch: [t(4, 6, 16), s(4, 10.5, 12), s(24, 6, 32), s(24, 9, 30), s(24, 12, 32), s(24, 15, 26), s(24, 20, 32), s(24, 23, 22)],
      },
    ]),
    eyebrow: introFields.eyebrow,
    title: inline({ type: "text", label: "Judul" } as const),
    body: inlineRichText("Isi"),
  },
  // Contoh yang layak terbit apa adanya, bukan perintah untuk pengelola: isi teks kaya tidak bisa diganti petunjuk.
  defaultProps: {
    variant: "single",
    eyebrow: "",
    title: "Kami mendengarkan dulu",
    body: "<p>Setiap pelanggan datang dengan kebutuhan yang berbeda. Karena itu kami mendengarkan dulu, lalu membantu Anda memilih produk atau layanan yang paling cocok.</p><p>Ada pertanyaan? Hubungi kami, kami senang membantu.</p>",
  },
  render: (props) => <TextBlock {...props} />,
}

// --- Tentang kami ------------------------------------------------------------------------------

export type AboutProps = {
  variant: "story" | "mission"
  eyebrow: InlineText
  title: InlineText
  body: string
  image: string | null
  stats: { value: string; label: string }[]
  vision: string
  mission: string
  values: { icon: string; title: InlineText; description: InlineText }[]
  button_label: string
  button_link: string
}

export function AboutBlock(props: BlockProps<AboutProps>) {
  const { variant, eyebrow, title, body, image, stats, puck } = props
  if (variant === "mission") {
    const cards = [
      { icon: EyeIcon, label: "Visi", text: props.vision, hint: "Visi usaha" },
      { icon: TargetIcon, label: "Misi", text: props.mission, hint: "Misi, satu per baris" },
    ].filter((card) => puck.isEditing || filled(card.text))
    const values = shownItems(props.values, (value) => filled(value.title), puck)
    // Visi, misi, nilai, dan ceritanya adalah isi bagian ini; tanpa itu judulnya saja tidak ditampilkan.
    if (!puck.isEditing && cards.length === 0 && values.length === 0 && !filled(body)) return null
    return (
      <Section className="flex flex-col gap-12">
        <div className="flex flex-col gap-3">
          <SectionIntro eyebrow={eyebrow} title={title} />
          <Paragraphs
            text={body}
            hint="Cerita singkat usaha"
            puck={puck}
            className="page-lead mx-auto max-w-2xl text-center text-lg text-pretty text-muted-foreground"
          />
        </div>
        {cards.length > 0 ? (
          <div className={cn("grid gap-4", listGrid(cards.length))}>
            {cards.map((card) => {
              const cardLines = lines(card.text)
              return (
                <div key={card.label} className="flex flex-col gap-4 rounded-2xl border bg-card p-8 shadow-xs">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <card.icon aria-hidden="true" className="size-5" />
                  </span>
                  <h3 className="text-xl font-semibold">{card.label}</h3>
                  {cardLines.length > 1 ? (
                    <ul className="flex list-disc flex-col gap-2 pl-5 text-pretty text-muted-foreground">
                      {cardLines.map((line, index) => (
                        <li key={index}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-lg text-pretty text-muted-foreground">{orHint(card.text, card.hint, puck)}</p>
                  )}
                </div>
              )
            })}
          </div>
        ) : null}
        {values.length > 0 ? (
          <ul className={cn("grid gap-8", columnsFor(values.length))}>
            {values.map((value, index) => {
              const description = orHint(value.description, "Penjelasan singkat", puck)
              return (
                <li key={index} className="flex items-start gap-4">
                  <FeatureIcon name={value.icon} />
                  <div className="flex flex-col gap-1">
                    <h3 className="font-semibold">{orHint(value.title, "Nama nilai", puck)}</h3>
                    {description ? <p className="text-sm text-pretty text-muted-foreground">{description}</p> : null}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}
      </Section>
    )
  }
  const shownStats = shownItems(stats, (stat) => filled(stat.value), puck)
  // Ceritanya, fotonya, dan angkanya adalah isi bagian ini; tanpa itu judulnya saja tidak ditampilkan.
  if (!puck.isEditing && !image && !filled(body) && shownStats.length === 0) return null
  // Tanpa foto (halaman terbit) ceritanya satu kolom, bukan separuh bagian yang kosong.
  const pictured = Boolean(image) || puck.isEditing
  // Angka pertama menempel di foto dan sisanya di bawah cerita, jadi tidak ada angka yang tampil dua kali.
  const badge = pictured ? shownStats[0] : undefined
  const listed = badge ? shownStats.slice(1) : shownStats
  return (
    <Section className={cn("grid items-center gap-12 lg:gap-16", pictured ? "lg:grid-cols-2" : "max-w-3xl")}>
      {pictured ? (
        <div className="relative">
          <BlockImage src={image} alt="" className="aspect-4/5 w-full rounded-3xl shadow-lg sm:aspect-4/3 lg:aspect-4/5" puck={puck} field="image" />
          {badge ? (
            <div className="absolute -bottom-6 left-6 flex flex-col rounded-2xl border bg-card px-5 py-4 shadow-xl">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">{orHint(badge.value, "Angka", puck)}</span>
              <span className="text-sm text-muted-foreground">{orHint(badge.label, "Label angka", puck)}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-col items-start gap-6">
        <SectionIntro eyebrow={eyebrow} title={title} align="left" />
        <Paragraphs text={body} hint="Ceritakan awal mula usaha dan cara kerjanya" puck={puck} className="text-lg text-pretty text-muted-foreground" />
        {listed.length > 0 ? (
          <dl className="flex w-full flex-wrap gap-x-10 gap-y-6 border-t pt-6">
            {listed.map((stat, index) => (
              <div key={index} className="flex flex-col-reverse gap-1">
                <dt className="text-sm text-muted-foreground">{orHint(stat.label, "Label angka", puck)}</dt>
                <dd className="text-3xl font-semibold tracking-tight tabular-nums">{orHint(stat.value, "Angka", puck)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <Buttons primary={{ label: props.button_label, link: props.button_link }} puck={puck} />
      </div>
    </Section>
  )
}

export const aboutConfig: ComponentConfig<AboutProps> = {
  label: "Tentang kami",
  fields: {
    variant: layoutField<AboutProps["variant"]>("Susunan", [
      {
        value: "story",
        label: "Cerita dan foto",
        sketch: [i(4, 3, 24, 30), c(7, 26, 12, 7), ...text(32, 4, 22), s(32, 13, 22), t(32, 25, 6), t(41, 25, 6), t(50, 25, 6)],
      },
      {
        value: "mission",
        label: "Visi, misi, nilai",
        sketch: [
          ...intro(30, 2, 22),
          c(4, 10, 25, 12),
          o(6, 12, 4),
          s(6, 18, 18),
          c(31, 10, 25, 12),
          o(33, 12, 4),
          s(33, 18, 18),
          o(5, 26, 4),
          s(11, 27, 9),
          o(24, 26, 4),
          s(30, 27, 9),
          o(43, 26, 4),
          s(49, 27, 7),
        ],
      },
    ]),
    eyebrow: introFields.eyebrow,
    title: inline({ type: "text", label: "Judul" } as const),
    // Cerita, visi, dan misi diurai per baris (paragraf atau butir), jadi hanya lewat panel.
    body: { type: "textarea", label: "Cerita usaha (satu paragraf per baris)" },
    image: imageField("Foto"),
    stats: {
      type: "array",
      label: "Angka (yang pertama menempel di foto)",
      max: 3,
      getItemSummary: (stat) => [stat.value, stat.label].filter(Boolean).join(" ") || "Angka",
      defaultItemProps: { value: "", label: "" },
      arrayFields: { value: { type: "text", label: "Angka" }, label: { type: "text", label: "Label di bawah angka" } },
    },
    vision: { type: "textarea", label: "Visi" },
    mission: { type: "textarea", label: "Misi (satu per baris)" },
    values: {
      type: "array",
      label: "Nilai yang kami pegang",
      max: 8,
      getItemSummary: (value) => textOf(value.title) || "Nilai",
      defaultItemProps: { icon: "heart", title: "", description: "" },
      arrayFields: {
        icon: iconField("Ikon"),
        title: inline({ type: "text", label: "Nama nilai" } as const),
        description: inline({ type: "textarea", label: "Penjelasan" } as const),
      },
    },
    button_label: { type: "text", label: "Teks tombol", placeholder: "Kosongkan bila tanpa tombol" },
    button_link: linkField,
  },
  resolveFields: showFields<AboutProps>({
    image: when("variant", "story"),
    stats: when("variant", "story"),
    button_label: when("variant", "story"),
    button_link: when("variant", "story"),
    vision: when("variant", "mission"),
    mission: when("variant", "mission"),
    values: when("variant", "mission"),
  }),
  // Cerita dan angka usaha adalah fakta: kosong sampai diisi, dan bagian tanpa isi tidak tampil bagi pengunjung.
  defaultProps: {
    variant: "story",
    eyebrow: "Tentang kami",
    title: "Mengenal kami lebih dekat",
    body: "",
    image: null,
    stats: [
      { value: "", label: "" },
      { value: "", label: "" },
      { value: "", label: "" },
    ],
    vision: "Menjadi pilihan yang dipercaya pelanggan karena mutu dan kejujurannya.",
    mission: "Mendengarkan kebutuhan setiap pelanggan\nMenjelaskan pilihan dan biaya sejak awal\nMenjaga mutu di setiap pekerjaan",
    values: [
      { icon: "heart", title: "Sepenuh hati", description: "Setiap pekerjaan kami anggap milik sendiri." },
      { icon: "shield-check", title: "Jujur", description: "Yang kami sampaikan sesuai dengan yang Anda terima." },
      { icon: "clock", title: "Tepat waktu", description: "Jadwal yang disepakati kami jaga." },
    ],
    button_label: "",
    button_link: "",
  },
  render: (props) => <AboutBlock {...props} />,
}

// --- Tim ---------------------------------------------------------------------------------------

/** Nama tetap string: dipakai untuk avatar, inisial, dan teks alternatif foto. */
type Member = { image: string | null; name: string; role: InlineText; bio?: InlineText; link?: string }

export type TeamProps = {
  eyebrow: InlineText
  title: InlineText
  subtitle: InlineText
  variant: "grid" | "cards" | "list"
  members: Member[]
}

/**
 * Kisi foto tim: empat atau tiga per baris, mana yang membagi rata jumlahnya,
 * supaya baris terakhir tidak menyisakan satu orang. Sedikit orang, kisinya
 * menyempit di tengah.
 */
function photoGrid(count: number): string {
  if (count <= 1) return "mx-auto w-full max-w-60"
  if (count === 2) return "mx-auto w-full max-w-lg grid-cols-2"
  if (count === 3) return "mx-auto w-full max-w-3xl grid-cols-2 sm:grid-cols-3"
  if (count % 4 === 0) return "grid-cols-2 md:grid-cols-4"
  if (count % 3 === 0) return "grid-cols-2 md:grid-cols-3"
  return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
}

function MemberLink({ member, puck }: { member: Member; puck: PuckContext }) {
  const target = resolveLink(member.link ?? "", puck)
  if (!target) return null
  return (
    <a
      href={puck.isEditing ? undefined : target}
      target={target.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
      className="text-sm font-medium underline-offset-4 hover:underline"
    >
      Lihat profil
    </a>
  )
}

export function TeamBlock({ eyebrow, title, subtitle, variant, members, puck }: BlockProps<TeamProps>) {
  const people = shownItems(members, (member) => filled(member.name), puck)
  // Orangnya adalah isi bagian ini: tanpa satu pun yang bernama, bagian ini tidak ditampilkan.
  if (people.length === 0 && !puck.isEditing) return null
  const copy = (member: Member) => ({
    name: orHint(member.name, "Nama", puck),
    role: orHint(member.role, "Peran", puck),
    bio: orHint(member.bio, "Ceritakan singkat orang ini", puck),
  })
  const photo = (member: Member, className: string) =>
    member.image ? (
      <BlockImage src={member.image} alt={member.name} className={className} puck={puck} field={itemField("members", members, member)} />
    ) : (
      // Tanpa foto: avatar dari namanya, supaya kisi tetap rapi bagi pengunjung.
      <div className={cn("flex items-center justify-center overflow-hidden rounded-xl border bg-muted", className)}>
        <Person name={member.name} className="aspect-square h-3/5 w-auto" />
      </div>
    )
  let body: ReactNode
  if (variant === "list") {
    body = (
      <ul className={cn("grid gap-x-10 gap-y-6", listGrid(people.length))}>
        {people.map((member, index) => {
          const text = copy(member)
          return (
            <li key={index} className="flex items-start gap-4">
              <Person name={member.name} image={member.image} className="size-14" />
              <div className="flex flex-col gap-1">
                <span className="font-semibold">{text.name}</span>
                {text.role ? <span className="text-sm text-muted-foreground">{text.role}</span> : null}
                {text.bio ? <p className="text-sm text-pretty text-muted-foreground">{text.bio}</p> : null}
                <MemberLink member={member} puck={puck} />
              </div>
            </li>
          )
        })}
      </ul>
    )
  } else if (variant === "cards") {
    body = (
      <ul className={cn("grid gap-6", cardColumns(people.length))}>
        {people.map((member, index) => {
          const text = copy(member)
          return (
            <li key={index} className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs">
              {photo(member, "aspect-4/3 w-full rounded-none border-0 border-b")}
              <div className="flex flex-1 flex-col items-start gap-1 p-5">
                <span className="font-semibold">{text.name}</span>
                {text.role ? <span className="text-sm text-muted-foreground">{text.role}</span> : null}
                {text.bio ? <p className="pt-2 text-sm text-pretty text-muted-foreground">{text.bio}</p> : null}
                <div className="mt-auto pt-3">
                  <MemberLink member={member} puck={puck} />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    )
  } else {
    body = (
      <ul className={cn("grid gap-6", photoGrid(people.length))}>
        {people.map((member, index) => {
          const text = copy(member)
          return (
            <li key={index} className="flex flex-col gap-3">
              {photo(member, "aspect-square w-full")}
              <div className="flex flex-col">
                <span className="font-semibold">{text.name}</span>
                {text.role ? <span className="text-sm text-muted-foreground">{text.role}</span> : null}
              </div>
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

const member = (name: string, role: string, bio: string): Member => ({ image: null, name, role, bio, link: "" })

export const teamConfig: ComponentConfig<TeamProps> = {
  label: "Tim",
  fields: {
    variant: layoutField<TeamProps["variant"]>("Susunan", [
      {
        value: "grid",
        label: "Kisi foto",
        sketch: [
          ...intro(30, 2, 22),
          i(4, 10, 11, 11),
          t(4, 23, 8),
          s(4, 26.5, 6),
          i(17, 10, 11, 11),
          t(17, 23, 8),
          s(17, 26.5, 6),
          i(30, 10, 11, 11),
          t(30, 23, 8),
          s(30, 26.5, 6),
          i(43, 10, 11, 11),
          t(43, 23, 8),
          s(43, 26.5, 6),
        ],
      },
      {
        value: "cards",
        label: "Kartu dengan cerita",
        sketch: [
          ...intro(30, 2, 22),
          c(5, 10, 15, 23),
          i(5, 10, 15, 10),
          t(7, 22.5, 9),
          s(7, 26, 11),
          c(22.5, 10, 15, 23),
          i(22.5, 10, 15, 10),
          t(24.5, 22.5, 9),
          s(24.5, 26, 11),
          c(40, 10, 15, 23),
          i(40, 10, 15, 10),
          t(42, 22.5, 9),
          s(42, 26, 11),
        ],
      },
      {
        value: "list",
        label: "Daftar ringkas",
        sketch: [
          ...intro(30, 2, 22),
          o(5, 11, 6),
          t(13, 11.5, 12),
          s(13, 15, 14),
          o(32, 11, 6),
          t(40, 11.5, 12),
          s(40, 15, 14),
          o(5, 22, 6),
          t(13, 22.5, 12),
          s(13, 26, 14),
          o(32, 22, 6),
          t(40, 22.5, 12),
          s(40, 26, 14),
        ],
      },
    ]),
    ...introFields,
    members: {
      type: "array",
      label: "Anggota",
      max: 24,
      getItemSummary: (item) => item.name || "Tanpa nama",
      defaultItemProps: member("", "", ""),
      arrayFields: {
        image: imageField("Foto (kosong: avatar otomatis)"),
        // Nama hanya lewat panel: ia juga menjadi avatar, inisial, dan teks alternatif foto (lihat Member).
        name: { type: "text", label: "Nama" },
        role: inline({ type: "text", label: "Peran atau jabatan" } as const),
        bio: inline({ type: "textarea", label: "Cerita singkat (tampil di susunan kartu dan daftar)" } as const),
        link: { ...linkField, label: "Tautan profil (boleh kosong)" },
      },
    },
  },
  defaultProps: {
    eyebrow: "Tim",
    title: "Kenali tim kami",
    subtitle: "",
    variant: "grid",
    // Orang sungguhan hanya dari pengelola: empat tempat kosong supaya bentuk kisinya terlihat di editor.
    members: [member("", "", ""), member("", "", ""), member("", "", ""), member("", "", "")],
  },
  render: (props) => <TeamBlock {...props} />,
}

// --- Sejarah -----------------------------------------------------------------------------------

type Milestone = { year: InlineText; title: InlineText; description: InlineText; image: string | null }

export type HistoryProps = {
  eyebrow: InlineText
  title: InlineText
  subtitle: InlineText
  variant: "vertical" | "alternating" | "horizontal"
  items: Milestone[]
}

export function HistoryBlock({ eyebrow, title, subtitle, variant, items, puck }: BlockProps<HistoryProps>) {
  const milestones = shownItems(items, (item) => filled(item.title, item.year), puck)
  // Peristiwa adalah isi bagian ini: tanpa satu pun yang terisi, bagian ini tidak ditampilkan.
  if (milestones.length === 0 && !puck.isEditing) return null
  const content = (item: Milestone, align: "left" | "right" = "left") => {
    const year = orHint(item.year, "Tahun", puck)
    const heading = orHint(item.title, "Judul peristiwa", puck)
    const description = orHint(item.description, "Ceritakan singkat peristiwanya", puck)
    return (
      <div className={cn("flex flex-col gap-2", align === "right" && "md:items-end md:text-right")}>
        {year ? (
          <Badge variant="secondary" radius="full" className="w-fit">
            {year}
          </Badge>
        ) : null}
        {heading ? <h3 className="text-lg font-semibold">{heading}</h3> : null}
        {description ? <p className="text-pretty text-muted-foreground">{description}</p> : null}
        {/* Foto peristiwa ada di bawah teksnya: tanpa foto tidak ada ruang yang tersisa kosong. */}
        {item.image ? (
          <BlockImage src={item.image} alt="" className="mt-2 aspect-video w-full max-w-sm rounded-xl" puck={puck} field={itemField("items", items, item)} />
        ) : null}
      </div>
    )
  }
  let body: ReactNode
  if (variant === "horizontal") {
    body = (
      <ol className="flex snap-x gap-6 overflow-x-auto pb-4">
        {milestones.map((item, index) => (
          <li key={index} className="relative flex w-64 shrink-0 snap-start flex-col gap-4 pt-2">
            <span aria-hidden="true" className="absolute top-[0.9rem] right-0 left-0 h-px bg-border" />
            <span aria-hidden="true" className="relative z-10 size-3.5 rounded-full border-2 border-background bg-primary ring-2 ring-primary/30" />
            {content(item)}
          </li>
        ))}
      </ol>
    )
  } else if (variant === "alternating") {
    body = (
      <ol className="relative flex flex-col gap-12 before:absolute before:inset-y-0 before:left-[0.4rem] before:w-px before:bg-border md:before:left-1/2">
        {milestones.map((item, index) => {
          const right = index % 2 === 1
          return (
            <li key={index} className="relative grid gap-6 pl-8 md:grid-cols-2 md:pl-0">
              <span
                aria-hidden="true"
                className="absolute top-1.5 left-0 size-3.5 rounded-full border-2 border-background bg-primary ring-2 ring-primary/30 md:left-1/2 md:-translate-x-1/2"
              />
              <div className={cn(right ? "md:col-start-2 md:pl-12" : "md:pr-12")}>{content(item, right ? "left" : "right")}</div>
            </li>
          )
        })}
      </ol>
    )
  } else {
    body = (
      <ol className="relative mx-auto flex w-full max-w-2xl flex-col gap-10 before:absolute before:inset-y-1 before:left-[0.4rem] before:w-px before:bg-border">
        {milestones.map((item, index) => (
          <li key={index} className="relative pl-10">
            <span aria-hidden="true" className="absolute top-1.5 left-0 size-3.5 rounded-full border-2 border-background bg-primary ring-2 ring-primary/30" />
            {content(item)}
          </li>
        ))}
      </ol>
    )
  }
  return (
    <Section className="flex flex-col gap-12">
      <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
      {body}
    </Section>
  )
}

const milestone = (year: string, title: string, description: string): Milestone => ({ year, title, description, image: null })

export const historyConfig: ComponentConfig<HistoryProps> = {
  label: "Sejarah",
  fields: {
    variant: layoutField<HistoryProps["variant"]>("Susunan", [
      {
        value: "vertical",
        label: "Satu garis",
        sketch: [
          ...intro(30, 2, 22),
          a(16.5, 10, 0.6, 23),
          o(15, 11, 3.5),
          a(21, 11, 6, 1.6),
          t(21, 14, 16),
          o(15, 19.5, 3.5),
          a(21, 19.5, 6, 1.6),
          t(21, 22.5, 16),
          o(15, 28, 3.5),
          a(21, 28, 6, 1.6),
          t(21, 31, 16),
        ],
      },
      {
        value: "alternating",
        label: "Kiri-kanan",
        sketch: [
          ...intro(30, 2, 22),
          a(29.7, 10, 0.6, 23),
          o(28.25, 11, 3.5),
          t(12, 11.5, 14),
          o(28.25, 19.5, 3.5),
          t(34, 20, 14),
          o(28.25, 28, 3.5),
          t(12, 28.5, 14),
        ],
      },
      {
        value: "horizontal",
        label: "Mendatar",
        sketch: [
          ...intro(30, 2, 22),
          a(4, 15.7, 52, 0.6),
          o(5, 14, 3.5),
          t(5, 21, 12),
          s(5, 25, 13),
          o(23, 14, 3.5),
          t(23, 21, 12),
          s(23, 25, 13),
          o(41, 14, 3.5),
          t(41, 21, 12),
          s(41, 25, 13),
        ],
      },
    ]),
    ...introFields,
    items: {
      type: "array",
      label: "Peristiwa",
      max: 30,
      getItemSummary: (item) => [textOf(item.year), textOf(item.title)].filter(Boolean).join(" · ") || "Peristiwa",
      defaultItemProps: milestone("", "", ""),
      arrayFields: {
        // Tahun hanya ditampilkan (tidak dipakai mengurutkan), jadi aman diketik langsung.
        year: inline({ type: "text", label: "Tahun" } as const),
        title: inline({ type: "text", label: "Judul peristiwa" } as const),
        description: inline({ type: "textarea", label: "Penjelasan" } as const),
        image: imageField("Foto (boleh kosong)"),
      },
    },
  },
  defaultProps: {
    eyebrow: "Perjalanan kami",
    title: "Dari awal sampai hari ini",
    subtitle: "",
    variant: "vertical",
    // Tahun dan peristiwa adalah fakta usaha: empat tempat kosong supaya bentuk garis waktunya terlihat di editor.
    items: [milestone("", "", ""), milestone("", "", ""), milestone("", "", ""), milestone("", "", "")],
  },
  render: (props) => <HistoryBlock {...props} />,
}
