"use client"

import { useState, type ReactNode } from "react"
import type { ComponentConfig, PuckContext } from "@puckeditor/core"
import { ArrowRightIcon, CheckIcon, EyeIcon, TargetIcon } from "lucide-react"
import { cn } from "cn"

import { Badge } from "@/components/reui/badge"
import { IconTile } from "@/components/reui/icon-tile"

import { BlockImage, resolveLink, richText, Section, SectionTitle, useOverlayPortal, type BlockProps } from "../blocks"
import { Backdrop, EffectFrame, type CardEffect } from "../effects"
import { cardEffectOptions, imageField, introFields, layoutField, linkField, showFields, sk, when } from "../fields"
import { iconField } from "../field-kit"
import { PageIcon } from "../page-icon"
import { Buttons, columnsFor, lines, Person, SectionIntro } from "./kit"

// Isi halaman: fitur, layanan, gambar + teks, langkah, teks, tentang kami,
// tim, dan sejarah.

const { t, s, b, i, c, a, o, p, intro, text } = sk

function FeatureIcon({ name, large }: { name: string; large?: boolean }) {
  return (
    <IconTile variant="solid" aria-hidden="true" className={cn(large && "size-14 rounded-2xl [&_svg]:size-6")}>
      <PageIcon name={name} />
    </IconTile>
  )
}

function Checklist({ items, className }: { items: { title: string; description?: string }[]; className?: string }) {
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

// --- Fitur -------------------------------------------------------------------------------------

type FeatureItem = { icon: string; title: string; description: string; image: string | null }

export type FeaturesProps = {
  eyebrow: string
  title: string
  subtitle: string
  layout: "grid" | "bento" | "list" | "icons" | "zigzag" | "tabs" | "checklist"
  card_effect: CardEffect
  image: string | null
  items: FeatureItem[]
}

function FeatureTabs({ items, puck }: { items: FeatureItem[]; puck: PuckContext }) {
  const [current, setCurrent] = useState(0)
  const portal = useOverlayPortal(puck)
  const active = items[Math.min(current, items.length - 1)]
  // Tanpa gambar sama sekali (halaman terbit), daftarnya selebar bagian.
  const pictures = puck.isEditing || items.some((item) => item.image)
  return (
    <div className={cn("grid items-center gap-8", pictures ? "lg:grid-cols-[1fr_1.4fr]" : "mx-auto w-full max-w-2xl")}>
      {/* Bisa diklik langsung di editor (overlay portal). */}
      <div role="tablist" aria-orientation="vertical" className="flex flex-col gap-2">
        {items.map((item, index) => (
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
              <span className="font-semibold">{item.title}</span>
              {item.description ? <span className="text-sm text-pretty text-muted-foreground">{item.description}</span> : null}
            </span>
          </button>
        ))}
      </div>
      {active && pictures ? <BlockImage key={current} src={active.image} alt="" className="aspect-4/3 w-full rounded-2xl shadow-lg" puck={puck} /> : null}
    </div>
  )
}

export function FeaturesBlock({ eyebrow, title, subtitle, layout, card_effect, image, items, puck }: BlockProps<FeaturesProps>) {
  const intro = <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
  if (layout === "checklist") {
    return (
      <Section className={cn("grid items-center gap-12", (image || puck.isEditing) && "lg:grid-cols-2")}>
        <div className="flex flex-col gap-8">
          <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} align="left" />
          <Checklist items={items} />
        </div>
        {image || puck.isEditing ? <BlockImage src={image} alt="" className="aspect-4/3 w-full rounded-2xl shadow-lg" puck={puck} /> : null}
      </Section>
    )
  }
  let body: ReactNode
  if (layout === "tabs") body = <FeatureTabs items={items} puck={puck} />
  else if (layout === "zigzag") {
    body = (
      <ul className="flex flex-col gap-16">
        {items.map((item, index) => (
          <li key={index} className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
            <BlockImage src={item.image} alt="" className={cn("aspect-4/3 w-full rounded-2xl shadow-sm", index % 2 === 1 && "md:order-2")} puck={puck} />
            <div className="flex flex-col items-start gap-4">
              <FeatureIcon name={item.icon} />
              <h3 className="text-2xl font-semibold tracking-tight">{item.title}</h3>
              {item.description ? <p className="text-lg text-pretty text-muted-foreground">{item.description}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    )
  } else if (layout === "icons") {
    body = (
      <ul className={cn("grid gap-x-8 gap-y-12", columnsFor(items.length))}>
        {items.map((item, index) => (
          <li key={index} className="flex flex-col items-center gap-4 text-center">
            <FeatureIcon name={item.icon} large />
            <h3 className="text-lg font-semibold">{item.title}</h3>
            {item.description ? <p className="max-w-xs text-pretty text-muted-foreground">{item.description}</p> : null}
          </li>
        ))}
      </ul>
    )
  } else if (layout === "list") {
    body = (
      <ul className="grid gap-x-12 gap-y-8 md:grid-cols-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-4">
            <FeatureIcon name={item.icon} />
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold">{item.title}</h3>
              {item.description ? <p className="text-pretty text-muted-foreground">{item.description}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    )
  } else {
    body = (
      <ul className={cn("grid gap-4", layout === "bento" ? "md:auto-rows-[minmax(13rem,auto)] md:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3")}>
        {items.map((item, index) => {
          // Bento: kartu lebar dan sempit bergantian, dua per baris.
          const wide = layout === "bento" && (index % 4 === 0 || index % 4 === 3)
          return (
            <li key={index} className={cn("flex", wide && "md:col-span-2")}>
              <EffectFrame effect={card_effect} className="flex flex-1 rounded-xl">
                <div
                  className={cn(
                    "relative isolate flex flex-1 flex-col gap-4 overflow-hidden rounded-xl border bg-card p-6 shadow-xs",
                    layout === "bento" && "justify-end"
                  )}
                >
                  {layout === "bento" ? <Backdrop kind="dots" /> : null}
                  <FeatureIcon name={item.icon} />
                  <div className="flex flex-col gap-1">
                    <h3 className="font-semibold">{item.title}</h3>
                    {item.description ? <p className="text-sm text-pretty text-muted-foreground">{item.description}</p> : null}
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
    image: imageField("Gambar"),
    items: {
      type: "array",
      label: "Fitur",
      max: 12,
      getItemSummary: (item) => item.title || "Fitur tanpa nama",
      defaultItemProps: feature("sparkles", "Keunggulan", "Satu kalimat: apa untungnya bagi pelanggan."),
      arrayFields: {
        icon: iconField("Ikon"),
        title: { type: "text", label: "Judul" },
        description: { type: "textarea", label: "Keterangan" },
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
    subtitle: "Hal-hal yang membuat pelanggan kembali lagi.",
    layout: "grid",
    card_effect: "none",
    image: null,
    items: [
      feature("zap", "Cepat", "Pesanan dikerjakan di hari yang sama."),
      feature("shield-check", "Bergaransi", "Ada masalah? Kami perbaiki tanpa biaya."),
      feature("wallet", "Harga jelas", "Tidak ada biaya tersembunyi."),
      feature("headset", "Mudah dihubungi", "Balas cepat lewat WhatsApp."),
      feature("truck", "Antar jemput", "Gratis untuk wilayah kota."),
      feature("star", "Berpengalaman", "Lebih dari sepuluh tahun melayani."),
    ],
  },
  render: (props) => <FeaturesBlock {...props} />,
}

// --- Layanan -----------------------------------------------------------------------------------

/** Data lama hanya punya title, description, dan icon. */
type Service = { title: string; description: string; icon: string; price?: string; image: string | null; link?: string }

export type ServicesProps = {
  eyebrow: string
  title: string
  subtitle: string
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
  const services = items.filter((service) => service.title.trim())
  const price = (service: Service) =>
    service.price ? (
      <span className="text-sm">
        {price_prefix ? <span className="text-muted-foreground">{price_prefix} </span> : null}
        <span className="font-semibold tabular-nums">{service.price}</span>
      </span>
    ) : null
  let body: ReactNode
  if (variant === "list") {
    body = (
      <ul className="mx-auto flex w-full max-w-4xl flex-col divide-y rounded-2xl border bg-card">
        {services.map((service, index) => (
          <li key={index} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
            <FeatureIcon name={service.icon} />
            <div className="flex flex-1 flex-col gap-1">
              <h3 className="font-semibold">{service.title}</h3>
              {service.description ? <p className="text-sm text-pretty text-muted-foreground">{service.description}</p> : null}
            </div>
            <div className="flex flex-col gap-1 sm:items-end">
              {price(service)}
              <ServiceLink service={service} label={link_label} puck={puck} />
            </div>
          </li>
        ))}
      </ul>
    )
  } else {
    body = (
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service, index) => (
          <li key={index} className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs">
            {variant === "images" ? (
              <BlockImage src={service.image ?? null} alt="" className="aspect-4/3 w-full rounded-none border-0 border-b" puck={puck} />
            ) : null}
            <div className="flex flex-1 flex-col gap-4 p-5">
              {variant !== "images" ? <FeatureIcon name={service.icon} /> : null}
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold">{service.title}</h3>
                {service.description ? <p className="text-sm text-pretty text-muted-foreground">{service.description}</p> : null}
              </div>
              {variant === "price" || variant === "images" ? (
                <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4">
                  {price(service) ?? <span />}
                  <ServiceLink service={service} label={link_label} puck={puck} />
                </div>
              ) : null}
            </div>
          </li>
        ))}
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
    link_label: { type: "text", label: "Teks tautan layanan", placeholder: "Pesan" },
    items: {
      type: "array",
      label: "Daftar layanan",
      max: 12,
      getItemSummary: (item) => item.title || "Layanan tanpa nama",
      defaultItemProps: service("package", "Nama layanan", "", ""),
      arrayFields: {
        title: { type: "text", label: "Nama" },
        description: { type: "textarea", label: "Keterangan" },
        icon: iconField("Ikon"),
        price: { type: "text", label: "Harga", placeholder: "Rp150.000" },
        image: imageField("Foto (untuk kartu berfoto)"),
        link: { ...linkField, label: "Tautan (boleh kosong)" },
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
    items: [
      service("headset", "Konsultasi", "Bicarakan kebutuhan Anda dengan tim kami.", "Gratis"),
      service("wrench", "Pengerjaan", "Dikerjakan tim sendiri, tepat waktu.", "Rp150.000"),
      service("truck", "Pengiriman", "Diantar ke alamat Anda.", "Rp25.000"),
    ],
  },
  render: (props) => <ServicesBlock {...props} />,
}

// --- Gambar + teks -----------------------------------------------------------------------------

export type ImageTextProps = {
  variant: "split" | "wide" | "points" | "numbers"
  eyebrow: string
  title: string
  body: string
  image: string | null
  image_position: "left" | "right"
  points: string
  stats: { value: string; label: string }[]
  button_label: string
  button_link: string
}

export function ImageTextBlock(props: BlockProps<ImageTextProps>) {
  const { variant, eyebrow, title, body, image, image_position, points, stats, puck } = props
  const copy = (center: boolean) => (
    <div className={cn("flex flex-col gap-5", center ? "items-center text-center" : "items-start")}>
      {eyebrow ? (
        <Badge variant="outline" radius="full">
          {eyebrow}
        </Badge>
      ) : null}
      {title ? <SectionTitle>{title}</SectionTitle> : null}
      {/* Baris baru yang diketik pengelola dipertahankan. */}
      {body ? <p className={cn("page-lead text-lg whitespace-pre-line text-pretty text-muted-foreground", center && "max-w-2xl")}>{body}</p> : null}
      {variant === "points" ? <Checklist items={lines(points).map((line) => ({ title: line }))} /> : null}
      {variant === "numbers" ? (
        <dl className="flex flex-wrap gap-x-10 gap-y-4 pt-2">
          {stats
            .filter((stat) => stat.value.trim())
            .map((stat, index) => (
              <div key={index} className="flex flex-col-reverse gap-1">
                <dt className="text-sm text-muted-foreground">{stat.label}</dt>
                <dd className="text-3xl font-semibold tracking-tight tabular-nums">{stat.value}</dd>
              </div>
            ))}
        </dl>
      ) : null}
      <Buttons primary={{ label: props.button_label, link: props.button_link }} align={center ? "center" : "left"} puck={puck} />
    </div>
  )
  const showImage = Boolean(image) || puck.isEditing
  if (variant === "wide") {
    return (
      <Section className="flex flex-col gap-10">
        {copy(true)}
        {showImage ? <BlockImage src={image} alt={title} className="aspect-video w-full rounded-3xl shadow-lg md:aspect-21/9" puck={puck} /> : null}
      </Section>
    )
  }
  return (
    <Section className={cn("grid items-center gap-10 lg:gap-16", showImage ? "md:grid-cols-2" : "max-w-3xl")}>
      {showImage ? (
        <BlockImage src={image} alt={title} className={cn("aspect-4/3 w-full rounded-2xl", image_position === "right" && "md:order-2")} puck={puck} />
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
    eyebrow: { type: "text", label: "Label kecil", placeholder: "Kosongkan bila tidak perlu" },
    title: { type: "text", label: "Judul" },
    body: { type: "textarea", label: "Isi" },
    points: { type: "textarea", label: "Poin (satu per baris)" },
    stats: {
      type: "array",
      label: "Angka",
      max: 4,
      getItemSummary: (stat) => [stat.value, stat.label].filter(Boolean).join(" ") || "Angka",
      defaultItemProps: { value: "10+", label: "Tahun pengalaman" },
      arrayFields: { value: { type: "text", label: "Angka", placeholder: "10+, 98%, 24 jam" }, label: { type: "text", label: "Keterangan" } },
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
    title: "Judul bagian",
    body: "Ceritakan sesuatu tentang gambar ini.",
    image: null,
    image_position: "left",
    points: "Dikerjakan tim sendiri\nBahan berkualitas\nBergaransi",
    stats: [
      { value: "10+", label: "Tahun pengalaman" },
      { value: "5.000+", label: "Pelanggan" },
      { value: "98%", label: "Puas" },
    ],
    button_label: "",
    button_link: "",
  },
  render: (props) => <ImageTextBlock {...props} />,
}

// --- Langkah -----------------------------------------------------------------------------------

/** Data lama tanpa `image`. */
type Step = { title: string; description: string; image: string | null }

export type StepsProps = {
  eyebrow: string
  title: string
  subtitle: string
  variant: "row" | "vertical" | "cards"
  items: Step[]
}

export function StepsBlock({ eyebrow, title, subtitle, variant, items, puck }: BlockProps<StepsProps>) {
  const number = (index: number, className?: string) => (
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full border bg-background font-semibold tabular-nums shadow-xs", className)}>
      {index + 1}
    </span>
  )
  let body: ReactNode
  if (variant === "vertical") {
    body = (
      <ol className="mx-auto flex w-full max-w-2xl flex-col">
        {items.map((item, index) => (
          <li key={index} className="relative flex gap-5 pb-10 last:pb-0">
            {index < items.length - 1 ? <span aria-hidden="true" className="absolute top-12 bottom-2 left-5 w-px bg-border" /> : null}
            {number(index, "bg-primary text-primary-foreground border-transparent")}
            <div className="flex flex-col gap-1 pt-1.5">
              <h3 className="text-lg font-semibold">{item.title}</h3>
              {item.description ? <p className="text-pretty text-muted-foreground">{item.description}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    )
  } else if (variant === "cards") {
    body = (
      <ol className={cn("grid gap-6", columnsFor(items.length))}>
        {items.map((item, index) => (
          <li key={index} className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs">
            <div className="relative">
              <BlockImage src={item.image ?? null} alt="" className="aspect-4/3 w-full rounded-none border-0 border-b" puck={puck} />
              {number(index, "absolute top-3 left-3")}
            </div>
            <div className="flex flex-col gap-1 p-5">
              {!item.image && !puck.isEditing ? <span className="text-sm font-medium text-muted-foreground">Langkah {index + 1}</span> : null}
              <h3 className="font-semibold">{item.title}</h3>
              {item.description ? <p className="text-sm text-pretty text-muted-foreground">{item.description}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    )
  } else {
    body = (
      <ol className={cn("grid gap-8", columnsFor(items.length))}>
        {items.map((item, index) => (
          <li key={index} className="relative flex flex-col gap-3">
            {/* Garis penghubung ke langkah berikutnya, hanya bila berjajar. */}
            {index < items.length - 1 ? <span aria-hidden="true" className="absolute top-5 right-0 left-14 hidden h-px bg-border md:block" /> : null}
            {number(index)}
            <h3 className="font-semibold">{item.title}</h3>
            {item.description ? <p className="text-pretty text-muted-foreground">{item.description}</p> : null}
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
      getItemSummary: (item, index) => item.title || `Langkah ${(index ?? 0) + 1}`,
      defaultItemProps: { title: "Langkah", description: "", image: null },
      arrayFields: {
        title: { type: "text", label: "Judul" },
        description: { type: "textarea", label: "Keterangan" },
        image: imageField("Foto (untuk kartu berfoto)"),
      },
    },
  },
  defaultProps: {
    eyebrow: "Cara kerja",
    title: "Tiga langkah mudah",
    subtitle: "",
    variant: "row",
    items: [
      { title: "Hubungi kami", description: "Ceritakan kebutuhan Anda lewat WhatsApp.", image: null },
      { title: "Terima penawaran", description: "Harga dan jadwal jelas sebelum mulai.", image: null },
      { title: "Beres", description: "Kami kerjakan sampai Anda puas.", image: null },
    ],
  },
  render: (props) => <StepsBlock {...props} />,
}

// --- Teks --------------------------------------------------------------------------------------

export type TextProps = { variant: "single" | "columns" | "side"; eyebrow: string; title: string; body: ReactNode }

export function TextBlock({ variant, eyebrow, title, body }: BlockProps<TextProps>) {
  const heading = (
    <div className="flex flex-col items-start gap-3">
      {eyebrow ? (
        <Badge variant="outline" radius="full">
          {eyebrow}
        </Badge>
      ) : null}
      {title ? <SectionTitle>{title}</SectionTitle> : null}
    </div>
  )
  if (variant === "side") {
    return (
      <Section className="grid gap-8 md:grid-cols-[1fr_2fr] md:gap-16">
        {heading}
        <div className={cn(richText, "page-lead text-lg text-muted-foreground")}>{body}</div>
      </Section>
    )
  }
  return (
    <Section className={cn(variant === "columns" ? "" : "max-w-3xl")}>
      <div className="flex flex-col gap-6">
        {heading}
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
    eyebrow: { type: "text", label: "Label kecil", placeholder: "Kosongkan bila tidak perlu" },
    title: { type: "text", label: "Judul" },
    body: { type: "richtext", label: "Isi" },
  },
  defaultProps: { variant: "single", eyebrow: "", title: "Judul bagian", body: "<p>Tulis isinya di sini.</p>" },
  render: (props) => <TextBlock {...props} />,
}

// --- Tentang kami ------------------------------------------------------------------------------

export type AboutProps = {
  variant: "story" | "mission"
  eyebrow: string
  title: string
  body: string
  image: string | null
  stats: { value: string; label: string }[]
  vision: string
  mission: string
  values: { icon: string; title: string; description: string }[]
  button_label: string
  button_link: string
}

export function AboutBlock(props: BlockProps<AboutProps>) {
  const { variant, eyebrow, title, body, image, stats, puck } = props
  if (variant === "mission") {
    return (
      <Section className="flex flex-col gap-12">
        <SectionIntro eyebrow={eyebrow} title={title} subtitle={body} />
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { icon: EyeIcon, label: "Visi", text: props.vision },
            { icon: TargetIcon, label: "Misi", text: props.mission },
          ]
            .filter((card) => card.text.trim())
            .map((card) => (
              <div key={card.label} className="flex flex-col gap-4 rounded-2xl border bg-card p-8 shadow-xs">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <card.icon aria-hidden="true" className="size-5" />
                </span>
                <h3 className="text-xl font-semibold">{card.label}</h3>
                {lines(card.text).length > 1 ? (
                  <ul className="flex list-disc flex-col gap-2 pl-5 text-pretty text-muted-foreground">
                    {lines(card.text).map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-lg text-pretty text-muted-foreground">{card.text}</p>
                )}
              </div>
            ))}
        </div>
        {props.values.length > 0 ? (
          <ul className={cn("grid gap-8", columnsFor(props.values.length))}>
            {props.values.map((value, index) => (
              <li key={index} className="flex items-start gap-4">
                <FeatureIcon name={value.icon} />
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold">{value.title}</h3>
                  {value.description ? <p className="text-sm text-pretty text-muted-foreground">{value.description}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>
    )
  }
  const shownStats = stats.filter((stat) => stat.value.trim())
  return (
    <Section className={cn("grid items-center gap-12 lg:gap-16", (image || puck.isEditing) && "lg:grid-cols-2")}>
      {image || puck.isEditing ? (
        <div className="relative">
          <BlockImage src={image} alt="" className="aspect-4/5 w-full rounded-3xl shadow-lg sm:aspect-4/3 lg:aspect-4/5" puck={puck} />
          {shownStats[0] ? (
            <div className="absolute -bottom-6 left-6 flex flex-col rounded-2xl border bg-card px-5 py-4 shadow-xl">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">{shownStats[0].value}</span>
              <span className="text-sm text-muted-foreground">{shownStats[0].label}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-col items-start gap-6">
        <SectionIntro eyebrow={eyebrow} title={title} align="left" />
        <div className="flex flex-col gap-4 text-lg text-pretty text-muted-foreground">
          {lines(body).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        {shownStats.length > 1 ? (
          <dl className="grid w-full grid-cols-2 gap-6 border-t pt-6 sm:grid-cols-3">
            {shownStats.map((stat, index) => (
              <div key={index} className="flex flex-col-reverse gap-1">
                <dt className="text-sm text-muted-foreground">{stat.label}</dt>
                <dd className="text-3xl font-semibold tracking-tight tabular-nums">{stat.value}</dd>
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
    eyebrow: { type: "text", label: "Label kecil", placeholder: "Kosongkan bila tidak perlu" },
    title: { type: "text", label: "Judul" },
    body: { type: "textarea", label: "Cerita (satu paragraf per baris)" },
    image: imageField("Foto"),
    stats: {
      type: "array",
      label: "Angka",
      max: 3,
      getItemSummary: (stat) => [stat.value, stat.label].filter(Boolean).join(" ") || "Angka",
      defaultItemProps: { value: "10+", label: "Tahun berdiri" },
      arrayFields: { value: { type: "text", label: "Angka" }, label: { type: "text", label: "Keterangan" } },
    },
    vision: { type: "textarea", label: "Visi" },
    mission: { type: "textarea", label: "Misi (satu per baris)" },
    values: {
      type: "array",
      label: "Nilai yang kami pegang",
      max: 8,
      getItemSummary: (value) => value.title || "Nilai",
      defaultItemProps: { icon: "heart", title: "Nilai", description: "" },
      arrayFields: { icon: iconField("Ikon"), title: { type: "text", label: "Nama" }, description: { type: "textarea", label: "Keterangan" } },
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
  defaultProps: {
    variant: "story",
    eyebrow: "Tentang kami",
    title: "Usaha keluarga sejak 2015",
    body: "Berawal dari garasi rumah, kami melayani tetangga sekitar dengan sepenuh hati.\nKini kami melayani pelanggan di seluruh kota, dengan cara kerja yang sama: rapi, jujur, dan tepat waktu.",
    image: null,
    stats: [
      { value: "10+", label: "Tahun berdiri" },
      { value: "5.000+", label: "Pelanggan" },
      { value: "12", label: "Orang tim" },
    ],
    vision: "Menjadi pilihan pertama warga kota untuk layanan yang rapi dan jujur.",
    mission: "Mengerjakan setiap pesanan dengan teliti\nMenjaga harga tetap jelas sejak awal\nMembuka lapangan kerja bagi warga sekitar",
    values: [
      { icon: "heart", title: "Sepenuh hati", description: "Setiap pesanan kami anggap milik sendiri." },
      { icon: "shield-check", title: "Jujur", description: "Harga dan hasil sesuai janji." },
      { icon: "clock", title: "Tepat waktu", description: "Jadwal yang disepakati kami tepati." },
    ],
    button_label: "",
    button_link: "",
  },
  render: (props) => <AboutBlock {...props} />,
}

// --- Tim ---------------------------------------------------------------------------------------

type Member = { image: string | null; name: string; role: string; bio?: string; link?: string }

export type TeamProps = {
  eyebrow: string
  title: string
  subtitle: string
  variant: "grid" | "cards" | "list"
  members: Member[]
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
  const people = members.filter((member) => member.name.trim())
  const photo = (member: Member, className: string) =>
    member.image ? (
      <BlockImage src={member.image} alt={member.name} className={className} puck={puck} />
    ) : (
      // Tanpa foto: avatar dari namanya, supaya kisi tetap rapi bagi pengunjung.
      <div className={cn("flex items-center justify-center overflow-hidden rounded-xl border bg-muted", className)}>
        <Person name={member.name} className="size-3/5" />
      </div>
    )
  let body: ReactNode
  if (variant === "list") {
    body = (
      <ul className="grid gap-x-10 gap-y-6 md:grid-cols-2">
        {people.map((member, index) => (
          <li key={index} className="flex items-start gap-4">
            <Person name={member.name} image={member.image} className="size-14" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold">{member.name}</span>
              {member.role ? <span className="text-sm text-muted-foreground">{member.role}</span> : null}
              {member.bio ? <p className="text-sm text-pretty text-muted-foreground">{member.bio}</p> : null}
              <MemberLink member={member} puck={puck} />
            </div>
          </li>
        ))}
      </ul>
    )
  } else if (variant === "cards") {
    body = (
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((member, index) => (
          <li key={index} className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs">
            {photo(member, "aspect-4/3 w-full rounded-none border-0 border-b")}
            <div className="flex flex-1 flex-col items-start gap-1 p-5">
              <span className="font-semibold">{member.name}</span>
              {member.role ? <span className="text-sm text-muted-foreground">{member.role}</span> : null}
              {member.bio ? <p className="pt-2 text-sm text-pretty text-muted-foreground">{member.bio}</p> : null}
              <div className="mt-auto pt-3">
                <MemberLink member={member} puck={puck} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    )
  } else {
    body = (
      <ul className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
        {people.map((member, index) => (
          <li key={index} className="flex flex-col gap-3">
            {photo(member, "aspect-square w-full")}
            <div className="flex flex-col">
              <span className="font-semibold">{member.name}</span>
              {member.role ? <span className="text-sm text-muted-foreground">{member.role}</span> : null}
            </div>
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
      defaultItemProps: member("Nama", "", ""),
      arrayFields: {
        image: imageField("Foto (kosong: avatar otomatis)"),
        name: { type: "text", label: "Nama" },
        role: { type: "text", label: "Jabatan" },
        bio: { type: "textarea", label: "Cerita singkat (untuk kartu dan daftar)" },
        link: { ...linkField, label: "Tautan profil (boleh kosong)" },
      },
    },
  },
  defaultProps: {
    eyebrow: "Tim",
    title: "Orang-orang di balik layanan kami",
    subtitle: "",
    variant: "grid",
    members: [
      member("Sari Wulandari", "Pemilik", "Memulai usaha ini dari garasi rumah pada 2015."),
      member("Budi Santoso", "Kepala produksi", "Memastikan setiap pesanan rapi sebelum dikirim."),
      member("Rina Wati", "Layanan pelanggan", "Yang membalas WhatsApp Anda dengan cepat."),
      member("Agus Pratama", "Pengiriman", "Hafal setiap sudut kota."),
    ],
  },
  render: (props) => <TeamBlock {...props} />,
}

// --- Sejarah -----------------------------------------------------------------------------------

type Milestone = { year: string; title: string; description: string; image: string | null }

export type HistoryProps = {
  eyebrow: string
  title: string
  subtitle: string
  variant: "vertical" | "alternating" | "horizontal"
  items: Milestone[]
}

export function HistoryBlock({ eyebrow, title, subtitle, variant, items, puck }: BlockProps<HistoryProps>) {
  const milestones = items.filter((item) => item.title.trim() || item.year.trim())
  const content = (item: Milestone, align: "left" | "right" = "left") => (
    <div className={cn("flex flex-col gap-2", align === "right" && "md:items-end md:text-right")}>
      <Badge variant="secondary" radius="full" className="w-fit">
        {item.year}
      </Badge>
      <h3 className="text-lg font-semibold">{item.title}</h3>
      {item.description ? <p className="text-pretty text-muted-foreground">{item.description}</p> : null}
      {item.image ? <BlockImage src={item.image} alt="" className="mt-2 aspect-video w-full max-w-sm rounded-xl" puck={puck} /> : null}
    </div>
  )
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
      getItemSummary: (item) => [item.year, item.title].filter(Boolean).join(" · ") || "Peristiwa",
      defaultItemProps: milestone("2025", "Peristiwa", ""),
      arrayFields: {
        year: { type: "text", label: "Tahun" },
        title: { type: "text", label: "Judul" },
        description: { type: "textarea", label: "Keterangan" },
        image: imageField("Foto (boleh kosong)"),
      },
    },
  },
  defaultProps: {
    eyebrow: "Perjalanan kami",
    title: "Dari garasi ke seluruh kota",
    subtitle: "",
    variant: "vertical",
    items: [
      milestone("2015", "Usaha dimulai", "Berawal dari garasi rumah dengan dua orang."),
      milestone("2018", "Toko pertama", "Membuka toko di pusat kota."),
      milestone("2021", "Tim bertambah", "Kini dua belas orang melayani setiap hari."),
      milestone("2024", "5.000 pelanggan", "Terima kasih atas kepercayaannya."),
    ],
  },
  render: (props) => <HistoryBlock {...props} />,
}
