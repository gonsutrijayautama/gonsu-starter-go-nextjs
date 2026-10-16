"use client"

import { useState, type ComponentType, type ReactNode } from "react"
import type { ComponentConfig, PuckContext } from "@puckeditor/core"
import { AtSignIcon, ClockIcon, MailIcon, MapIcon, MapPinIcon, MessageCircleIcon, NavigationIcon, PhoneIcon } from "lucide-react"
import { cn } from "cn"

import { channelLinks, emailHref, phoneHref, type Site } from "@/lib/site"
import { Button, buttonVariants } from "@/components/ui/button"

import { anchorOf, ColorScope, GradientScope, type Appearance } from "../appearance"
import { BlockImage, editable, hasText, orHint, pageButton, Section, SectionTitle, type BlockMetadata, type BlockProps, type InlineText } from "../blocks"
import { Backdrop, HighlightText, type BackdropKind, type ButtonEffect, type TextEffect } from "../effects"
import { backgroundField, buttonEffectField, effectField, imageField, inline, introFields, layoutField, linkField, showFields, sk, when } from "../fields"
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
  // InlineText: isian yang bisa diketik langsung di kanvas (`inline` di callToActionConfig).
  title: InlineText
  highlight: string
  effect: TextEffect
  subtitle: InlineText
  primary_label: InlineText
  primary_link: string
  secondary_label: InlineText
  secondary_link: string
  button_effect: ButtonEffect
  background: BackdropKind
  image: string | null
  color: string
  color2: string
}

const hexColor = /^#[0-9a-f]{6}$/i

/**
 * Warna gradien pilihan sendiri. Satu warna saja: polos dengan warna itu
 * sampai warna kedua dipilih. Tanpa warna: null, berarti gradien dari warna
 * utama tema (`themeGradient`).
 */
function chosenGradient(color: string, color2: string): { from: string; to: string } | null {
  const from = hexColor.test(color) ? color : hexColor.test(color2) ? color2 : ""
  if (!from) return null
  return { from, to: hexColor.test(color2) ? color2 : from }
}

/**
 * Gradien bawaan Ajakan: warna utama tema ke warna dengan terang dan
 * kepekatan yang sama, hanya ronanya digeser. Teks warna-depan-utama tetap
 * terbaca di kedua ujungnya, di tema terang maupun gelap. Di dalam ColorScope
 * `--primary` sudah dipetakan ulang ke warna teks, jadi dasarnya
 * `--surface-bg`. Peramban tanpa sintaks warna relatif mendapat warna utama
 * polos dari ColorScope.
 */
const themeGradient = "linear-gradient(135deg, var(--surface-bg), oklch(from var(--surface-bg) l c calc(h + 60)))"

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
      {hasText(title) || highlight.trim() || puck.isEditing ? (
        <h2 className="page-title max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
          {orHint(title, "Judul ajakan", puck)}
          {highlight ? (
            <>
              {" "}
              <HighlightText text={highlight} effect={effect} />
            </>
          ) : null}
        </h2>
      ) : null}
      {hasText(subtitle) ? <p className="page-lead max-w-xl text-lg text-pretty text-muted-foreground">{subtitle}</p> : null}
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
          {image || puck.isEditing ? <BlockImage src={image} alt="" className="min-h-64 w-full rounded-none border-0" puck={puck} field="image" /> : null}
        </div>
      </Section>
    )
  }
  if (variant === "gradient") {
    const box = "relative isolate overflow-hidden rounded-3xl px-6 py-16 sm:px-12"
    const content = (
      <>
        <div aria-hidden="true" className="absolute -top-24 -right-24 -z-10 size-80 rounded-full bg-white/15 blur-2xl" />
        <div aria-hidden="true" className="absolute -bottom-28 -left-20 -z-10 size-72 rounded-full bg-black/10 blur-2xl" />
        <div className="flex flex-col items-center gap-8">
          {heading(true)}
          {buttons(true)}
        </div>
      </>
    )
    // Halaman lama menyimpan warnanya sendiri dan tetap memakainya.
    const chosen = chosenGradient(props.color, props.color2)
    return (
      <Section>
        {chosen ? (
          <GradientScope from={chosen.from} to={chosen.to} className={box}>
            {content}
          </GradientScope>
        ) : (
          <ColorScope background="primary" className={box}>
            <div aria-hidden="true" className="absolute inset-0 -z-20" style={{ backgroundImage: themeGradient }} />
            {content}
          </ColorScope>
        )}
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
    // Satu baris: halaman publik menyatukan baris judul, jadi Enter di kanvas
    // ditolak supaya editor dan pengunjung melihat judul yang sama.
    title: inline({ type: "text", label: "Judul" } as const),
    // Dirender langsung sesudah judul di baris yang sama: lanjutan kalimatnya, bukan kata dari judul.
    // Tidak diketik di kanvas: kata-katanya dipecah untuk efek berganti dan diketik.
    highlight: { type: "text", label: "Lanjutan judul (diberi efek)", placeholder: "Disambung langsung sesudah judul" },
    effect: effectField,
    subtitle: inline({ type: "textarea", label: "Kalimat" } as const),
    primary_label: inline({ type: "text", label: "Tombol utama" } as const),
    primary_link: linkField,
    secondary_label: inline({ type: "text", label: "Tombol kedua", placeholder: "Kosongkan bila tanpa tombol kedua" } as const),
    secondary_link: { ...linkField, label: "Tautan tombol kedua" },
    button_effect: buttonEffectField,
    background: backgroundField,
    image: imageField("Gambar"),
    color: colorField("Warna awal gradien", "Otomatis: gradien dari warna utama tema."),
    color2: colorField("Warna akhir gradien", "Otomatis: gradien dari warna utama tema."),
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
    // Kosong = gradien dari warna tema, yang terbaca di tema terang dan gelap.
    color: "",
    color2: "",
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
function MapEmbed({
  site,
  puck,
  className,
  placeholderClassName,
}: {
  site: Site
  puck: PuckContext
  className?: string
  /** Kelas tambahan untuk tempat peta (bukan peta yang sudah dimuat), mis. menjauhkan isinya dari kartu yang menumpuk. */
  placeholderClassName?: string
}) {
  const [shown, setShown] = useState(false)
  const query = [site.contact.address, site.contact.city].filter(Boolean).join(", ")
  if (!query) {
    if (!puck.isEditing) return null
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl border border-dashed bg-muted p-6 text-center text-sm text-muted-foreground",
          className,
          placeholderClassName
        )}
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
      className={cn(
        "relative isolate flex flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border bg-muted p-6 text-center",
        className,
        placeholderClassName
      )}
    >
      <Backdrop kind="grid" />
      <span className="flex size-12 items-center justify-center rounded-full bg-background shadow-sm">
        <MapIcon aria-hidden="true" className="size-5" />
      </span>
      <p className="max-w-xs text-sm text-pretty text-muted-foreground">{query}</p>
      <Button type="button" variant="outline" className={pageButton} onClick={() => setShown(true)} disabled={puck.isEditing}>
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
        <a key={channel.label} href={channel.href} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline" }), pageButton)}>
          {channel.label}
        </a>
      ))}
    </div>
  )
}

function ContactRows({ rows }: { rows: Row[] }) {
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
  title: InlineText
  note: InlineText
  hours: Hours
}

/**
 * Lebar kartu kanal menurut jumlahnya. Kisi menempelkan baris yang tidak
 * penuh ke kiri (5 kartu jadi 3 + 2 berat sebelah); dengan flex-wrap baris
 * terakhir di tengah. Kelipatan 4 memakai 4 kolom supaya barisnya penuh.
 * Kelas Tailwind harus tertulis utuh. Jarak antarkartu `gap-4` (1rem).
 */
function cardWidth(count: number): string {
  if (count % 4 === 0) return "w-full sm:w-[calc((100%_-_1rem)/2)] lg:w-[calc((100%_-_3rem)/4)]"
  return "w-full sm:w-[calc((100%_-_1rem)/2)] lg:w-[calc((100%_-_2rem)/3)]"
}

export function ContactBlock({
  variant,
  title,
  note,
  hours,
  appearance,
  puck,
}: BlockProps<ContactProps> & {
  /** Tampilan bagian (config.tsx `withLook`): dibaca hanya untuk id jangkarnya. */
  appearance?: Partial<Appearance>
}) {
  const site = siteOf(puck)
  const rows = rowsOf(site)
  const channels = channelLinks(site.channels)
  // "kontak" adalah jangkar bawaan tombol "#kontak". Bila Tampilan sudah
  // memberi id, id itu dipasang di pembungkus bagian; id kedua di sini akan
  // membuat jangkar ganda.
  const id = anchorOf(appearance?.anchor ?? "") ? undefined : "kontak"

  if (variant === "cards") {
    const whatsapp = site.channels.whatsapp
    const cards: Row[] = [
      ...(whatsapp ? [{ icon: MessageCircleIcon, label: "WhatsApp", value: "Balasan paling cepat", href: whatsapp, action: "Chat sekarang" }] : []),
      ...rows.filter((row) => row.label !== "Jam buka"),
      ...channels
        .filter((channel) => channel.label !== "WhatsApp")
        .map((channel) => ({ icon: AtSignIcon, label: channel.label, value: "Ikuti kabar terbaru", href: channel.href, action: "Kunjungi" })),
    ]
    // Tanpa satu kanal pun, bagi pengunjung bagian ini hanya judul dan kalimat.
    if (cards.length === 0 && !puck.isEditing) return null
    return (
      <Section id={id} className="flex flex-col gap-10">
        <SectionIntro title={title} subtitle={note} />
        {cards.length > 0 ? (
          <ul className="flex flex-wrap justify-center gap-4">
            {cards.map((card) => (
              <li key={card.label} className={cn("flex flex-col gap-3 rounded-2xl border bg-card p-6 shadow-xs", cardWidth(cards.length))}>
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
                    className={cn(buttonVariants({ variant: "outline" }), pageButton, "mt-auto self-start")}
                  >
                    {card.action}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          missingProfile
        )}
      </Section>
    )
  }

  const list = variant === "hours" ? hoursOf(hours, site) : []
  // Bagi pengunjung: tanpa satu pun data kontak, bagian ini hanya judul dan
  // kalimat — tidak dirender. Editor tetap menunjukkan cara mengisinya.
  if (!puck.isEditing && rows.length === 0 && channels.length === 0 && list.length === 0) return null

  const address = [site.contact.address, site.contact.city].filter(Boolean).join(", ")
  // Susunan jam buka menampilkan jam di kanan, jadi baris jam di kiri dibuang (dulu tampil dua kali).
  const leftRows = variant === "info" ? [] : variant === "hours" ? rows.filter((row) => row.label !== "Jam buka") : rows
  const sideFilled = variant === "map" ? Boolean(address) : variant === "hours" ? list.length > 0 : rows.length > 0
  const heading = editable(title, "Judul bagian")
  const side =
    variant === "map" ? (
      <MapEmbed site={site} puck={puck} className="min-h-80" />
    ) : variant === "hours" ? (
      list.length === 0 ? (
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
          <HoursList hours={list} />
        </div>
      )
    ) : rows.length > 0 ? (
      <ContactRows rows={rows} />
    ) : puck.isEditing ? (
      missingProfile
    ) : null
  return (
    <Section id={id}>
      {/* Sisi kanan kosong (mis. hanya kanal yang terisi): satu kolom, bukan separuh kisi yang kosong. */}
      <div className={cn("grid items-start gap-10", (sideFilled || puck.isEditing) && "md:grid-cols-2")}>
        <div className="flex flex-col gap-4">
          {heading ? <SectionTitle>{heading}</SectionTitle> : null}
          {hasText(note) ? <p className="page-lead text-lg text-pretty text-muted-foreground">{note}</p> : null}
          <ContactRows rows={leftRows} />
          <ChannelButtons site={site} />
        </div>
        {side}
      </div>
    </Section>
  )
}

const hoursField = {
  type: "array",
  label: "Jam buka (kosong: dari Profil bisnis)",
  max: 10,
  getItemSummary: (row: Hours[number]) => [row.day, row.time].filter(Boolean).join(" · ") || "Hari",
  // Baris baru kosong: jam karangan yang lupa diubah tampil sebagai jam buka sungguhan.
  defaultItemProps: { day: "", time: "" },
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
    title: inline({ type: "text", label: "Judul" } as const),
    note: inline({ type: "textarea", label: "Kalimat pembuka" } as const),
    hours: hoursField,
  },
  resolveFields: showFields<ContactProps>({ hours: when("variant", "hours") }),
  defaultProps: {
    variant: "info",
    title: "Hubungi kami",
    // Kosong: kalimat petunjuk untuk pengelola akan ikut terbit ke pengunjung.
    note: "",
    hours: [],
  },
  render: (props) => <ContactBlock {...props} />,
}

// --- Lokasi & jam buka -------------------------------------------------------------------------

export type LocationProps = {
  variant: "split" | "card" | "compact"
  // InlineText: introFields dan catatan bisa diketik langsung di kanvas.
  eyebrow: InlineText
  title: InlineText
  subtitle: InlineText
  hours: Hours
  note: InlineText
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
      {hasText(note) ? <p className="text-sm text-pretty text-muted-foreground">{note}</p> : null}
      {address ? (
        <div className="flex flex-wrap gap-2">
          <a href={puck.isEditing ? undefined : directions} target="_blank" rel="noreferrer" className={cn(buttonVariants(), pageButton)}>
            <NavigationIcon aria-hidden="true" />
            Petunjuk arah
          </a>
          {phoneHref(site.contact.phone) ? (
            <a href={puck.isEditing ? undefined : phoneHref(site.contact.phone)} className={cn(buttonVariants({ variant: "outline" }), pageButton)}>
              <PhoneIcon aria-hidden="true" />
              Telepon
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  )

  // Bagi pengunjung: tanpa alamat dan jam buka tidak ada yang bisa ditunjukkan.
  if (!puck.isEditing && !address && list.length === 0) return null

  // Tanpa alamat tidak ada peta: bagi pengunjung, kartu di atas peta dan
  // peta di samping rincian menjadi kotak biasa, bukan kolom yang kosong.
  if (variant === "card" && (address || puck.isEditing)) {
    return (
      <Section className="flex flex-col gap-10">
        <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
        {/* Mulai md peta dan kartu berbagi satu sel kisi: tinggi bagian
            mengikuti yang lebih tinggi, jadi kartu yang panjang tidak keluar
            dari peta. Isi tempat peta digeser ke kanan kartu supaya tidak
            tertutup (lebar kartu 24rem + jarak 1,5rem + sela 1rem). */}
        <div className="flex flex-col md:grid">
          <MapEmbed
            site={site}
            puck={puck}
            className="h-[28rem] md:col-start-1 md:row-start-1 md:h-full md:min-h-[28rem]"
            placeholderClassName="md:pl-[26.5rem]"
          />
          <div className="relative mx-4 -mt-24 rounded-2xl border bg-card p-6 shadow-xl md:col-start-1 md:row-start-1 md:m-6 md:w-96 md:self-start">
            {details}
          </div>
        </div>
      </Section>
    )
  }
  if (variant === "compact" || (!address && !puck.isEditing)) {
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
    note: inline({ type: "text", label: "Catatan", placeholder: "Petunjuk tambahan untuk pengunjung" } as const),
  },
  defaultProps: {
    variant: "split",
    eyebrow: "",
    title: "Kunjungi kami",
    subtitle: "",
    // Kosong: jam buka dibaca dari Profil bisnis. Jam contoh di sini akan
    // menang atas jam sungguhan (lihat `hoursOf`).
    hours: [],
    note: "",
  },
  render: (props) => <LocationBlock {...props} />,
}
