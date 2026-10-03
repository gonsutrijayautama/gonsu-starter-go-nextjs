"use client"

import { useState, type ComponentType, type ReactNode } from "react"
import type { ComponentConfig, PuckContext } from "@puckeditor/core"
import { AtSignIcon, ClockIcon, MailIcon, MapIcon, MapPinIcon, MessageCircleIcon, NavigationIcon, PhoneIcon } from "lucide-react"
import { cn } from "cn"

import { channelLinks, emailHref, phoneHref, type Site } from "@/lib/site"
import { Button, buttonVariants } from "@/components/ui/button"

import { ColorScope, GradientScope } from "../appearance"
import { BlockImage, Section, SectionTitle, type BlockMetadata, type BlockProps } from "../blocks"
import { Backdrop, HighlightText, type BackdropKind, type ButtonEffect, type TextEffect } from "../effects"
import { backgroundField, buttonEffectField, effectField, imageField, introFields, layoutField, linkField, showFields, sk, when } from "../fields"
import { colorField } from "../field-kit"
import { Buttons, SectionIntro } from "./kit"

// Ajakan dan kontak: ajakan bertindak, kontak, serta lokasi dan jam buka.
// Alamat, telepon, dan kanal dibaca dari profil bisnis (metadata.site).

const { t, s, b, g, i, c, a, p, w, o, intro, text } = sk

const siteOf = (puck: PuckContext) => (puck.metadata as BlockMetadata).site

// --- Ajakan ------------------------------------------------------------------------------------

export type CallToActionProps = {
  variant: "banner" | "split" | "image" | "gradient"
  tone: "card" | "primary" | "muted" | "inverse"
  title: string
  highlight: string
  effect: TextEffect
  subtitle: string
  primary_label: string
  primary_link: string
  secondary_label: string
  secondary_link: string
  button_effect: ButtonEffect
  background: BackdropKind
  image: string | null
  color: string
  color2: string
}

function Tone({ tone, className, children }: { tone: CallToActionProps["tone"]; className: string; children: ReactNode }) {
  if (tone === "primary" || tone === "inverse") {
    return (
      <ColorScope background={tone} className={className}>
        {children}
      </ColorScope>
    )
  }
  return <div className={cn(className, tone === "muted" ? "bg-muted" : "border bg-card shadow-xs")}>{children}</div>
}

export function CallToActionBlock(props: BlockProps<CallToActionProps>) {
  const { variant, tone, title, highlight, effect, subtitle, background, image, puck } = props
  const heading = (center: boolean) => (
    <div className={cn("flex flex-col gap-4", center ? "items-center text-center" : "items-start")}>
      <h2 className="page-title max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
        {title}
        {highlight ? (
          <>
            {" "}
            <HighlightText text={highlight} effect={effect} />
          </>
        ) : null}
      </h2>
      {subtitle ? <p className="page-lead max-w-xl text-lg text-pretty text-muted-foreground">{subtitle}</p> : null}
    </div>
  )
  const buttons = (center: boolean) => (
    <Buttons
      primary={{ label: props.primary_label, link: props.primary_link }}
      secondary={{ label: props.secondary_label, link: props.secondary_link }}
      effect={props.button_effect}
      align={center ? "center" : "left"}
      puck={puck}
      className="shrink-0"
    />
  )

  if (variant === "split") {
    return (
      <Section>
        <Tone
          tone={tone}
          className="relative isolate flex flex-col gap-8 overflow-hidden rounded-3xl px-6 py-10 sm:px-12 md:flex-row md:items-center md:justify-between"
        >
          {tone === "card" ? <Backdrop kind={background} /> : null}
          {heading(false)}
          {buttons(false)}
        </Tone>
      </Section>
    )
  }
  if (variant === "image") {
    return (
      <Section>
        <div className={cn("grid overflow-hidden rounded-3xl border bg-card shadow-xs", (image || puck.isEditing) && "md:grid-cols-2")}>
          <div className="flex flex-col justify-center gap-8 p-8 sm:p-12">
            {heading(false)}
            {buttons(false)}
          </div>
          {image || puck.isEditing ? <BlockImage src={image} alt="" className="min-h-64 w-full rounded-none border-0" puck={puck} /> : null}
        </div>
      </Section>
    )
  }
  if (variant === "gradient") {
    return (
      <Section>
        <GradientScope from={props.color} to={props.color2} className="relative isolate overflow-hidden rounded-3xl px-6 py-16 sm:px-12">
          <div aria-hidden="true" className="absolute -top-24 -right-24 -z-10 size-80 rounded-full bg-white/15 blur-2xl" />
          <div aria-hidden="true" className="absolute -bottom-28 -left-20 -z-10 size-72 rounded-full bg-black/10 blur-2xl" />
          <div className="flex flex-col items-center gap-8">
            {heading(true)}
            {buttons(true)}
          </div>
        </GradientScope>
      </Section>
    )
  }
  return (
    <Section>
      <Tone tone={tone} className="relative isolate flex flex-col items-center gap-8 overflow-hidden rounded-3xl px-6 py-16 sm:px-12">
        {tone === "card" ? <Backdrop kind={background} /> : null}
        {heading(true)}
        {buttons(true)}
      </Tone>
    </Section>
  )
}

export const callToActionConfig: ComponentConfig<CallToActionProps> = {
  label: "Ajakan",
  fields: {
    variant: layoutField<CallToActionProps["variant"]>("Susunan", [
      { value: "banner", label: "Kotak di tengah", sketch: [c(4, 4, 52, 28), ...intro(30, 9, 30), b(21, 21), g(31, 21)] },
      { value: "split", label: "Teks kiri, tombol kanan", sketch: [c(4, 9, 52, 18), t(8, 13, 22), s(8, 17.5, 18), b(36, 15.5), g(46, 15.5, 7)] },
      { value: "image", label: "Dengan gambar", sketch: [c(4, 4, 52, 28), ...text(8, 10, 18), b(8, 22), i(30, 4, 26, 28)] },
      { value: "gradient", label: "Gradien warna", sketch: [p(4, 4, 52, 28), a(30, 4, 26, 28), w(17, 11, 26, 2.6), w(21, 16, 18), c(25.5, 21, 9, 3)] },
    ]),
    tone: {
      type: "radio",
      label: "Warna kotak",
      options: [
        { label: "Kartu", value: "card" },
        { label: "Lembut", value: "muted" },
        { label: "Utama", value: "primary" },
        { label: "Gelap", value: "inverse" },
      ],
    },
    title: { type: "textarea", label: "Judul" },
    highlight: { type: "text", label: "Kata yang disorot" },
    effect: effectField,
    subtitle: { type: "textarea", label: "Kalimat" },
    primary_label: { type: "text", label: "Tombol utama" },
    primary_link: linkField,
    secondary_label: { type: "text", label: "Tombol kedua", placeholder: "Kosongkan bila tanpa tombol kedua" },
    secondary_link: { ...linkField, label: "Tautan tombol kedua" },
    button_effect: buttonEffectField,
    background: backgroundField,
    image: imageField("Gambar"),
    color: colorField("Warna awal gradien"),
    color2: colorField("Warna akhir gradien"),
  },
  resolveFields: showFields<CallToActionProps>({
    tone: when("variant", "banner", "split"),
    effect: (props) => Boolean(props.highlight?.trim()),
    background: (props) => (props.variant === "banner" || props.variant === "split") && props.tone === "card",
    image: when("variant", "image"),
    color: when("variant", "gradient"),
    color2: when("variant", "gradient"),
  }),
  defaultProps: {
    variant: "banner",
    tone: "card",
    title: "Siap mulai",
    highlight: "hari ini?",
    effect: "gradient",
    subtitle: "Hubungi kami sekarang, kami bantu dari awal sampai selesai.",
    primary_label: "Hubungi kami",
    primary_link: "#kontak",
    secondary_label: "",
    secondary_link: "",
    button_effect: "none",
    background: "glow",
    image: null,
    color: "#6366f1",
    color2: "#ec4899",
  },
  render: (props) => <CallToActionBlock {...props} />,
}

/** Data lama: "Ajakan" (body, button_label, style) dan "Ajakan sorot" (CtaSpotlight). */
export function callToActionFrom(type: string, props: Record<string, unknown>): Record<string, unknown> {
  if (type === "CtaSpotlight") return { ...props, variant: "banner", tone: "card" }
  if (props.variant) return props
  const { body, button_label, button_link, style, ...rest } = props
  return {
    ...rest,
    variant: "banner",
    tone: style === "subtle" ? "muted" : "primary",
    subtitle: body ?? "",
    primary_label: button_label ?? "",
    primary_link: button_link ?? "",
    highlight: "",
    background: "none",
  }
}

// --- Bagian bersama kontak dan lokasi ----------------------------------------------------------

type Row = { icon: ComponentType<{ className?: string }>; label: string; value: string; href?: string; action?: string }

function rowsOf(site: Site): Row[] {
  const { contact } = site
  const address = [contact.address, contact.city].filter(Boolean).join(", ")
  return [
    { icon: MapPinIcon, label: "Alamat", value: address, href: contact.map_url || undefined, action: "Buka peta" },
    { icon: PhoneIcon, label: "Telepon", value: contact.phone, href: phoneHref(contact.phone), action: "Telepon" },
    { icon: MailIcon, label: "Email", value: contact.email, href: emailHref(contact.email), action: "Kirim email" },
    { icon: ClockIcon, label: "Jam buka", value: contact.hours },
  ].filter((row) => row.value)
}

function mapsSearch(site: Site): string {
  const query = [site.name, site.contact.address, site.contact.city].filter(Boolean).join(", ")
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

/**
 * Peta Google, baru dimuat saat pengunjung memintanya: tanpa itu Google tidak
 * menerima kunjungan apa pun dari halaman ini. Di editor hanya tempatnya.
 */
function MapEmbed({ site, puck, className }: { site: Site; puck: PuckContext; className?: string }) {
  const [shown, setShown] = useState(false)
  const query = [site.contact.address, site.contact.city].filter(Boolean).join(", ")
  if (!query) {
    if (!puck.isEditing) return null
    return (
      <div
        className={cn("flex items-center justify-center rounded-2xl border border-dashed bg-muted p-6 text-center text-sm text-muted-foreground", className)}
      >
        Alamat belum diisi. Isi di Pengaturan → Profil bisnis.
      </div>
    )
  }
  if (shown && !puck.isEditing) {
    return (
      <iframe
        title={`Peta ${site.name || "lokasi"}`}
        src={`https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className={cn("w-full rounded-2xl border", className)}
      />
    )
  }
  return (
    <div
      className={cn("relative isolate flex flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border bg-muted p-6 text-center", className)}
    >
      <Backdrop kind="grid" />
      <span className="flex size-12 items-center justify-center rounded-full bg-background shadow-sm">
        <MapIcon aria-hidden="true" className="size-5" />
      </span>
      <p className="max-w-xs text-sm text-pretty text-muted-foreground">{query}</p>
      <Button type="button" variant="outline" onClick={() => setShown(true)} disabled={puck.isEditing}>
        Tampilkan peta
      </Button>
    </div>
  )
}

type Hours = { day: string; time: string }[]

/** Jam buka dari blok, atau dari profil bisnis (satu baris per hari). */
function hoursOf(hours: Hours, site: Site): Hours {
  const own = hours.filter((row) => row.day.trim() || row.time.trim())
  if (own.length > 0) return own
  return site.contact.hours
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [day, ...time] = line.split(/\s(?=\d)/)
      return { day: day ?? line, time: time.join(" ") }
    })
}

function HoursList({ hours, className }: { hours: Hours; className?: string }) {
  if (hours.length === 0) return null
  return (
    <dl className={cn("flex flex-col divide-y rounded-xl border bg-card text-sm", className)}>
      {hours.map((row, index) => (
        <div key={index} className="flex items-center justify-between gap-4 px-4 py-2.5">
          <dt className="text-muted-foreground">{row.day}</dt>
          <dd className="font-medium tabular-nums">{row.time}</dd>
        </div>
      ))}
    </dl>
  )
}

function ChannelButtons({ site }: { site: Site }) {
  const channels = channelLinks(site.channels)
  if (channels.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {channels.map((channel) => (
        <a key={channel.label} href={channel.href} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline" }))}>
          {channel.label}
        </a>
      ))}
    </div>
  )
}

function ContactRows({ site }: { site: Site }) {
  const rows = rowsOf(site)
  if (rows.length === 0) return null
  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card">
      {rows.map((row) => (
        <li key={row.label} className="flex items-start gap-3 p-4">
          <row.icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          {row.href ? (
            <a href={row.href} className="underline-offset-4 hover:underline">
              {row.value}
            </a>
          ) : (
            <span className="whitespace-pre-line">{row.value}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

const missingProfile = (
  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
    Alamat, telepon, dan email belum diisi. Isi di Pengaturan → Profil bisnis.
  </p>
)

// --- Kontak ------------------------------------------------------------------------------------

export type ContactProps = {
  variant: "info" | "cards" | "map" | "hours"
  title: string
  note: string
  hours: Hours
}

export function ContactBlock({ variant, title, note, hours, puck }: BlockProps<ContactProps>) {
  const site = siteOf(puck)
  const empty = rowsOf(site).length === 0 && channelLinks(site.channels).length === 0

  if (variant === "cards") {
    const whatsapp = site.channels.whatsapp
    const cards: Row[] = [
      ...(whatsapp ? [{ icon: MessageCircleIcon, label: "WhatsApp", value: "Balasan paling cepat", href: whatsapp, action: "Chat sekarang" }] : []),
      ...rowsOf(site).filter((row) => row.label !== "Jam buka"),
      ...channelLinks(site.channels)
        .filter((channel) => channel.label !== "WhatsApp")
        .map((channel) => ({ icon: AtSignIcon, label: channel.label, value: "Ikuti kabar terbaru", href: channel.href, action: "Kunjungi" })),
    ]
    return (
      <Section id="kontak" className="flex flex-col gap-10">
        <SectionIntro title={title} subtitle={note} />
        {cards.length > 0 ? (
          <ul className={cn("grid gap-4 sm:grid-cols-2", cards.length >= 3 && "lg:grid-cols-3", cards.length === 4 && "lg:grid-cols-4")}>
            {cards.map((card) => (
              <li key={card.label} className="flex flex-col gap-3 rounded-2xl border bg-card p-6 shadow-xs">
                <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <card.icon aria-hidden="true" className="size-5" />
                </span>
                <span className="font-semibold">{card.label}</span>
                <span className="text-sm break-words text-muted-foreground">{card.value}</span>
                {card.href ? (
                  <a
                    href={card.href}
                    target={card.href.startsWith("http") ? "_blank" : undefined}
                    rel="noreferrer"
                    className={cn(buttonVariants({ variant: "outline" }), "mt-auto self-start")}
                  >
                    {card.action}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : puck.isEditing ? (
          missingProfile
        ) : null}
      </Section>
    )
  }

  const side =
    variant === "map" ? (
      <MapEmbed site={site} puck={puck} className="min-h-80" />
    ) : variant === "hours" ? (
      hoursOf(hours, site).length === 0 ? (
        puck.isEditing ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Isi jam buka di isian blok ini, atau di Pengaturan → Profil bisnis.
          </p>
        ) : null
      ) : (
        <div className="flex flex-col gap-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <ClockIcon aria-hidden="true" className="size-4" />
            Jam buka
          </h3>
          <HoursList hours={hoursOf(hours, site)} />
        </div>
      )
    ) : (
      <ContactRows site={site} />
    )
  return (
    <Section id="kontak">
      <div className="grid items-start gap-10 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <SectionTitle>{title}</SectionTitle>
          {note ? <p className="page-lead text-lg text-pretty text-muted-foreground">{note}</p> : null}
          {variant !== "info" ? <ContactRows site={site} /> : null}
          <ChannelButtons site={site} />
        </div>
        {empty && puck.isEditing && variant === "info" ? missingProfile : side}
      </div>
    </Section>
  )
}

const hoursField = {
  type: "array",
  label: "Jam buka (kosong: dari Profil bisnis)",
  max: 10,
  getItemSummary: (row: Hours[number]) => [row.day, row.time].filter(Boolean).join(" · ") || "Hari",
  defaultItemProps: { day: "Senin–Jumat", time: "08.00–17.00" },
  arrayFields: { day: { type: "text", label: "Hari" }, time: { type: "text", label: "Jam", placeholder: "08.00–17.00 atau Tutup" } },
} as const

export const contactConfig: ComponentConfig<ContactProps> = {
  label: "Kontak",
  fields: {
    variant: layoutField<ContactProps["variant"]>("Susunan", [
      {
        value: "info",
        label: "Teks dan rincian",
        sketch: [...text(4, 8, 22), g(4, 20, 8), g(13, 20, 8), c(32, 6, 24, 24), s(35, 10, 16), s(35, 16, 14), s(35, 22, 16)],
      },
      {
        value: "cards",
        label: "Kartu kanal",
        sketch: [
          ...intro(30, 3),
          c(4, 12, 12, 19),
          o(6, 14, 4),
          c(17.5, 12, 12, 19),
          o(19.5, 14, 4),
          c(31, 12, 12, 19),
          o(33, 14, 4),
          c(44.5, 12, 12, 19),
          o(46.5, 14, 4),
        ],
      },
      { value: "map", label: "Dengan peta", sketch: [...text(4, 6, 20), c(4, 16, 22, 14), i(30, 5, 26, 26), o(41, 15, 4)] },
      {
        value: "hours",
        label: "Dengan jam buka",
        sketch: [...text(4, 6, 20), c(4, 16, 22, 14), c(32, 6, 24, 24), s(35, 10, 8), s(46, 10, 7), s(35, 16, 8), s(46, 16, 7), s(35, 22, 8), s(46, 22, 7)],
      },
    ]),
    title: { type: "text", label: "Judul" },
    note: { type: "textarea", label: "Kalimat pembuka" },
    hours: hoursField,
  },
  resolveFields: showFields<ContactProps>({ hours: when("variant", "hours") }),
  defaultProps: {
    variant: "info",
    title: "Hubungi kami",
    note: "Alamat, telepon, dan kanal diambil dari Profil bisnis dan Website.",
    hours: [],
  },
  render: (props) => <ContactBlock {...props} />,
}

// --- Lokasi & jam buka -------------------------------------------------------------------------

export type LocationProps = {
  variant: "split" | "card" | "compact"
  eyebrow: string
  title: string
  subtitle: string
  hours: Hours
  note: string
}

export function LocationBlock({ variant, eyebrow, title, subtitle, hours, note, puck }: BlockProps<LocationProps>) {
  const site = siteOf(puck)
  const address = [site.contact.address, site.contact.city].filter(Boolean).join(", ")
  const list = hoursOf(hours, site)
  const directions = site.contact.map_url || mapsSearch(site)
  const details = (
    <div className="flex flex-col gap-6">
      {address ? (
        <div className="flex items-start gap-3">
          <MapPinIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold">{site.name || "Alamat"}</span>
            <span className="text-pretty text-muted-foreground">{address}</span>
          </div>
        </div>
      ) : puck.isEditing ? (
        missingProfile
      ) : null}
      {list.length > 0 ? (
        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-2 text-sm font-medium">
            <ClockIcon aria-hidden="true" className="size-4" />
            Jam buka
          </span>
          <HoursList hours={list} />
        </div>
      ) : null}
      {note ? <p className="text-sm text-pretty text-muted-foreground">{note}</p> : null}
      {address ? (
        <div className="flex flex-wrap gap-2">
          <a href={puck.isEditing ? undefined : directions} target="_blank" rel="noreferrer" className={cn(buttonVariants())}>
            <NavigationIcon aria-hidden="true" />
            Petunjuk arah
          </a>
          {phoneHref(site.contact.phone) ? (
            <a href={puck.isEditing ? undefined : phoneHref(site.contact.phone)} className={cn(buttonVariants({ variant: "outline" }))}>
              <PhoneIcon aria-hidden="true" />
              Telepon
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  )

  // Tanpa alamat tidak ada peta: kartu di atas peta menjadi kotak biasa.
  if (variant === "card" && (address || puck.isEditing)) {
    return (
      <Section className="flex flex-col gap-10">
        <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
        <div className="relative">
          <MapEmbed site={site} puck={puck} className="h-[28rem]" />
          <div className="mx-4 -mt-24 rounded-2xl border bg-card p-6 shadow-xl md:absolute md:top-6 md:left-6 md:mx-0 md:mt-0 md:w-96">{details}</div>
        </div>
      </Section>
    )
  }
  if (variant === "compact" || (variant === "card" && !address)) {
    return (
      <Section className="flex max-w-3xl flex-col gap-8">
        <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
        <div className="rounded-2xl border bg-card p-6 shadow-xs sm:p-8">{details}</div>
      </Section>
    )
  }
  return (
    <Section className="grid items-start gap-10 md:grid-cols-[1.3fr_1fr]">
      <MapEmbed site={site} puck={puck} className="min-h-96 md:h-full" />
      <div className="flex flex-col gap-8">
        <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} align="left" />
        {details}
      </div>
    </Section>
  )
}

export const locationConfig: ComponentConfig<LocationProps> = {
  label: "Lokasi & jam buka",
  fields: {
    variant: layoutField<LocationProps["variant"]>("Susunan", [
      { value: "split", label: "Peta dan rincian", sketch: [i(4, 4, 30, 28), o(17, 14, 4), ...text(38, 6, 18), c(38, 16, 18, 10), b(38, 28)] },
      {
        value: "card",
        label: "Peta dengan kartu",
        sketch: [...intro(30, 2, 22), i(4, 9, 52, 24), c(8, 12, 18, 18), s(10, 15, 12), s(10, 19, 10), b(10, 24, 8), o(40, 18, 4)],
      },
      { value: "compact", label: "Tanpa peta", sketch: [...intro(30, 3), c(12, 12, 36, 21), s(15, 15, 18), s(15, 20, 26), s(15, 23, 26), b(15, 28)] },
    ]),
    ...introFields,
    hours: hoursField,
    note: { type: "text", label: "Catatan", placeholder: "Parkir tersedia di depan toko." },
  },
  defaultProps: {
    variant: "split",
    eyebrow: "",
    title: "Kunjungi kami",
    subtitle: "",
    hours: [
      { day: "Senin–Jumat", time: "08.00–17.00" },
      { day: "Sabtu", time: "08.00–14.00" },
      { day: "Minggu", time: "Tutup" },
    ],
    note: "",
  },
  render: (props) => <LocationBlock {...props} />,
}
