"use client"

import type { ComponentConfig } from "@puckeditor/core"
import { cn } from "cn"

import { ColorScope } from "../appearance"
import { BlockImage, hasText, Hint, orHint, Section, shownItems, stackVars, textOf, type BlockProps, type InlineText } from "../blocks"
import { MediaPickButton } from "../media-picker"
import { Backdrop, DeviceFrame, HighlightText, type ButtonEffect, type TextEffect } from "../effects"
import { VideoBlock } from "../extras"
import { buttonEffectField, effectField, imageField, inline, layoutField, linkField, showFields, sk, videoField, when, yesNoField } from "../fields"
import { videoSource } from "../video-source"
import { AnnouncementPill, Buttons, Logo, PeopleStack, Stars } from "./kit"

// Pembuka halaman: satu blok dengan beberapa susunan. Menggantikan "Pembuka"
// dan "Pembuka sorot" lama (lihat `heroFrom` untuk data lama).

export type HeroProps = {
  variant: "centered" | "split" | "background" | "mockup" | "collage" | "video"
  badge_text: InlineText
  badge_link: string
  // InlineText: isian yang bisa diketik langsung di kanvas (`inline` di heroConfig).
  title: InlineText
  highlight: string
  effect: TextEffect
  subtitle: InlineText
  primary_label: InlineText
  primary_link: string
  secondary_label: InlineText
  secondary_link: string
  button_effect: ButtonEffect
  image: string | null
  image_side: "right" | "left"
  frame: "glow" | "browser" | "phone"
  images: { image: string | null }[]
  video_url: string
  align: "left" | "center"
  proof: "yes" | "no"
  proof_names: string
  proof_text: InlineText
  proof_rating: number
  logos: "yes" | "no"
  logos_title: InlineText
  logo_items: { name: string; image: string | null }[]
}

/**
 * Bukti sosial: hanya bagian yang diisi pengelola. Contoh bawaannya kosong
 * karena rating, jumlah pelanggan, dan nama yang dikarang terbaca sebagai
 * fakta usaha di halaman publik.
 */
function Proof({ props, center }: { props: BlockProps<HeroProps>; center: boolean }) {
  const { proof_names, proof_rating, proof_text, puck } = props
  const names = proof_names.trim()
  const rating = proof_rating > 0 ? proof_rating : 0
  const text = orHint(proof_text, "Kalimat bukti yang benar, mis. jumlah pelanggan", puck)
  if (!names && !rating && !text) return null
  return (
    <div className={cn("flex flex-wrap items-center gap-3", center && "justify-center")}>
      {names ? <PeopleStack names={names} /> : puck.isEditing ? <Hint className="text-sm">Foto dari nama pelanggan</Hint> : null}
      <div className="flex flex-col gap-0.5 text-sm">
        {rating ? (
          <span className="flex items-center gap-1.5">
            <Stars value={rating} />
            <span className="font-medium tabular-nums">{rating.toLocaleString("id-ID")}</span>
          </span>
        ) : null}
        {text ? <span className="text-muted-foreground">{text}</span> : null}
      </div>
    </div>
  )
}

function Copy({ props, center, large }: { props: BlockProps<HeroProps>; center: boolean; large?: boolean }) {
  const { badge_text, badge_link, title, highlight, effect, subtitle, puck } = props
  return (
    <div className={cn("flex flex-col gap-6", center ? "items-center text-center" : "items-start")}>
      {hasText(badge_text) ? <AnnouncementPill text={badge_text} link={badge_link} puck={puck} /> : null}
      {hasText(title) || highlight.trim() || puck.isEditing ? (
        <h1
          className={cn(
            "page-title font-semibold tracking-tighter text-balance",
            large ? "max-w-4xl text-4xl leading-[1.05] sm:text-6xl" : "text-4xl leading-[1.06] sm:text-5xl lg:text-[3.5rem]"
          )}
        >
          {orHint(title, "Judul besar", puck)}
          {/* Lanjutan judul di baris sendiri, seperti pembuka Launch UI. */}
          {highlight ? (
            <span className="block">
              <HighlightText text={highlight} effect={effect} />
            </span>
          ) : null}
        </h1>
      ) : null}
      {hasText(subtitle) ? <p className={cn("page-lead max-w-2xl text-lg text-pretty text-muted-foreground", large && "sm:text-xl")}>{subtitle}</p> : null}
      <Buttons
        primary={{ label: props.primary_label, link: props.primary_link }}
        secondary={{ label: props.secondary_label, link: props.secondary_link }}
        effect={props.button_effect}
        align={center ? "center" : "left"}
        puck={puck}
      />
      {props.proof === "yes" ? <Proof props={props} center={center} /> : null}
    </div>
  )
}

function LogoRow({ props }: { props: BlockProps<HeroProps> }) {
  const { logos, logos_title, logo_items, puck } = props
  if (logos !== "yes") return null
  // Di editor logo yang belum diisi tetap tampil sebagai petunjuk; pengunjung hanya melihat yang terisi.
  const items = shownItems(logo_items, (item) => Boolean(item.name.trim() || item.image), puck)
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-5 pt-12">
      {hasText(logos_title) ? <p className="text-center text-sm font-medium text-muted-foreground">{logos_title}</p> : null}
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
        {items.map((item, index) =>
          item.name.trim() || item.image ? (
            <Logo key={index} name={item.name} image={item.image} />
          ) : (
            <Hint key={index} className="flex h-9 items-center text-lg">
              Nama mitra
            </Hint>
          )
        )}
      </div>
    </div>
  )
}

/** Media susunan ini benar-benar terisi: tanpa itu pengunjung melihat susunan tengah. */
function hasMedia(props: HeroProps): boolean {
  if (props.variant === "collage") return props.images.some((item) => Boolean(item.image))
  if (props.variant === "video") return videoSource(props.video_url) !== null
  return Boolean(props.image)
}

function Media({ props }: { props: BlockProps<HeroProps> }) {
  const { variant, image, puck } = props
  if (variant === "collage") {
    const images = puck.isEditing ? props.images : props.images.filter((item) => item.image)
    if (images.length === 0) return null
    // Kolase bertingkat: kolom kanan turun sedikit.
    const ratios = ["aspect-3/4", "aspect-square", "aspect-square", "aspect-3/4"]
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {[0, 1].map((column) => (
          <div key={column} className={cn("flex flex-col gap-3 sm:gap-4", column === 1 && "pt-10")}>
            {images
              .map((item, index) => ({ ...item, index }))
              .filter((item) => item.index % 2 === column)
              .map((item) => (
                <BlockImage
                  key={item.index}
                  src={item.image}
                  alt=""
                  className={cn("w-full rounded-2xl shadow-lg", ratios[item.index] ?? "aspect-square")}
                  puck={puck}
                  field={`images.${item.index}.image`}
                />
              ))}
          </div>
        ))}
      </div>
    )
  }
  if (variant === "video") {
    return (
      <div className={cn(stackVars, "rounded-2xl shadow-xl")}>
        <VideoBlock url={props.video_url} title={textOf(props.title)} thumbnail={image} style="dialog" frame="none" puck={puck} field="video_url" />
      </div>
    )
  }
  if (!image && !puck.isEditing) return null
  return <BlockImage src={image} alt="" className="aspect-4/3 w-full rounded-2xl shadow-xl" puck={puck} field="image" />
}

export function HeroBlock(props: BlockProps<HeroProps>) {
  const { variant, image, puck } = props

  if (variant === "background") {
    const center = props.align === "center"
    const copy = (
      <div className={cn("max-w-3xl", center && "mx-auto")}>
        <Copy props={props} center={center} large />
      </div>
    )
    return (
      <Section>
        {image ? (
          <ColorScope
            background="inverse"
            className={cn(
              "relative isolate flex min-h-[32rem] flex-col overflow-hidden rounded-3xl px-6 py-14 sm:px-12 lg:min-h-[38rem] lg:py-20",
              center ? "justify-center" : "justify-end"
            )}
          >
            <div aria-hidden="true" className="absolute inset-0 -z-10">
              <BlockImage src={image} alt="" className="size-full rounded-none border-0" puck={puck} />
              <div className={cn("absolute inset-0", center ? "bg-black/55" : "bg-linear-to-t from-black/80 via-black/45 to-black/10")} />
            </div>
            <MediaPickButton puck={puck} field="image" filled className="top-4 right-4" />
            {copy}
          </ColorScope>
        ) : (
          // Tanpa gambar: panel warna utama berpola, setinggi isinya. Tinggi
          // minimum hanya berguna untuk memperlihatkan gambar; tanpa gambar ia
          // menjadi lempeng kosong di atas teks di layar ponsel. Editor
          // melihat panel yang sama, dengan tombol untuk memilih gambar.
          <ColorScope background="primary" className="relative isolate overflow-hidden rounded-3xl px-6 py-16 sm:px-12 lg:py-24">
            <Backdrop kind="grid" />
            <Backdrop kind="glow" />
            <MediaPickButton puck={puck} field="image" filled={false} className="top-4 right-4" />
            {copy}
          </ColorScope>
        )}
        <LogoRow props={props} />
      </Section>
    )
  }

  // Tanpa media, pengunjung mendapat susunan tengah (di bawah): separuh
  // kosong di samping teks terlihat seperti blok yang rusak. Editor tetap
  // memperlihatkan tempat medianya supaya bisa diisi.
  if ((variant === "split" || variant === "collage" || variant === "video") && (puck.isEditing || hasMedia(props))) {
    return (
      <Section className="pt-12 lg:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className={cn(props.image_side === "left" && "lg:order-2")}>
            <Copy props={props} center={false} />
          </div>
          <Media props={props} />
        </div>
        <LogoRow props={props} />
      </Section>
    )
  }

  // Tengah, dengan atau tanpa gambar dalam bingkai di bawahnya.
  const framed = variant === "mockup" && (image || puck.isEditing)
  return (
    <Section className="flex flex-col items-center gap-6 pt-16 text-center lg:pt-24">
      <Copy props={props} center large />
      {framed ? (
        <div className={cn("relative isolate mt-10 w-full", props.frame === "phone" ? "max-w-xs" : "max-w-5xl")}>
          <div aria-hidden="true" className="page-mockup-glow" />
          {props.frame === "browser" || props.frame === "phone" ? (
            <DeviceFrame kind={props.frame}>
              <BlockImage
                src={image}
                alt=""
                className={cn("w-full rounded-none border-0", props.frame === "phone" ? "aspect-[9/19]" : "aspect-video")}
                puck={puck}
                field="image"
              />
            </DeviceFrame>
          ) : (
            <div className="rounded-2xl border bg-card/60 p-2 shadow-2xl backdrop-blur">
              <BlockImage src={image} alt="" className="aspect-video w-full" puck={puck} field="image" />
            </div>
          )}
        </div>
      ) : null}
      <div className="w-full">
        <LogoRow props={props} />
      </div>
    </Section>
  )
}

const { t, b, g, i, c, a, d, o, intro, text } = sk

export const heroConfig: ComponentConfig<HeroProps> = {
  label: "Pembuka",
  fields: {
    variant: layoutField<HeroProps["variant"]>("Susunan", [
      { value: "centered", label: "Teks di tengah", sketch: [...intro(30, 9, 34), b(21, 20), g(31, 20)] },
      { value: "split", label: "Teks dan gambar", sketch: [...text(4, 9, 24), b(4, 20), i(33, 6, 23, 24)] },
      { value: "background", label: "Gambar latar penuh", sketch: [d(3, 3, 54, 30), t(8, 17, 26), a(8, 21.5, 20, 1.3), b(8, 25)] },
      { value: "mockup", label: "Gambar berbingkai", sketch: [...intro(30, 4, 30), b(25.5, 11), c(10, 17, 40, 17), i(12, 20, 36, 14)] },
      {
        value: "collage",
        label: "Kolase foto",
        sketch: [...text(4, 9, 22), b(4, 20), i(32, 4, 11, 16), i(32, 22, 11, 10), i(45, 9, 11, 11), i(45, 22, 11, 11)],
      },
      { value: "video", label: "Dengan video", sketch: [...text(4, 9, 22), b(4, 20), i(31, 9, 25, 15), o(40.5, 13.5, 6)] },
    ]),
    badge_text: inline({ type: "text", label: "Pengumuman kecil di atas judul", placeholder: "Kosongkan bila tidak perlu" } as const),
    badge_link: { type: "text", label: "Tautan pengumuman", placeholder: "/layanan, #kontak, atau https://…" },
    // Satu baris: halaman publik menyatukan baris judul, jadi Enter di kanvas
    // ditolak supaya editor dan pengunjung melihat judul yang sama.
    title: inline({ type: "text", label: "Judul besar" } as const),
    // Baris kedua dirender di bawah judul, jadi isinya lanjutan kalimat judul — bukan kata yang diulang dari judul.
    // Tidak diketik di kanvas: kata-katanya dipecah untuk efek berganti dan diketik.
    highlight: { type: "text", label: "Baris kedua judul (diberi efek)", placeholder: "Lanjutan kalimat judul, bukan kata dari judul" },
    effect: effectField,
    subtitle: inline({ type: "textarea", label: "Kalimat di bawahnya" } as const),
    primary_label: inline({ type: "text", label: "Tombol utama", placeholder: "Kosongkan bila tanpa tombol" } as const),
    primary_link: linkField,
    secondary_label: inline({ type: "text", label: "Tombol kedua", placeholder: "Kosongkan bila tanpa tombol kedua" } as const),
    secondary_link: { ...linkField, label: "Tautan tombol kedua" },
    button_effect: buttonEffectField,
    image: imageField("Gambar"),
    // Nilai yang tersimpan adalah sisi gambar ("right": gambar di kanan).
    image_side: {
      type: "radio",
      label: "Letak gambar",
      options: [
        { label: "Gambar di kanan", value: "right" },
        { label: "Gambar di kiri", value: "left" },
      ],
    },
    frame: {
      type: "radio",
      label: "Bingkai gambar",
      options: [
        { label: "Kaca", value: "glow" },
        { label: "Peramban", value: "browser" },
        { label: "Ponsel", value: "phone" },
      ],
    },
    images: {
      type: "array",
      label: "Foto kolase (hingga 4)",
      max: 4,
      getItemSummary: (_, index) => `Foto ${(index ?? 0) + 1}`,
      defaultItemProps: { image: null },
      arrayFields: { image: imageField("Foto") },
    },
    video_url: videoField("Video"),
    align: {
      type: "radio",
      label: "Perataan teks",
      options: [
        { label: "Kiri, di bawah", value: "left" },
        { label: "Tengah", value: "center" },
      ],
    },
    proof: yesNoField("Bukti sosial (foto pelanggan dan rating)"),
    proof_names: { type: "text", label: "Nama pelanggan untuk foto (pisahkan dengan koma)" },
    proof_rating: { type: "number", label: "Rating (0 = tanpa bintang)", min: 0, max: 5, step: 0.1 },
    proof_text: inline({ type: "text", label: "Kalimat bukti", placeholder: "Hanya fakta yang benar tentang usaha Anda" } as const),
    logos: yesNoField("Logo mitra di bawah"),
    logos_title: inline({ type: "text", label: "Kalimat di atas logo" } as const),
    logo_items: {
      type: "array",
      label: "Logo",
      max: 12,
      getItemSummary: (item) => item.name || "Logo tanpa nama",
      defaultItemProps: { name: "", image: null },
      arrayFields: { name: { type: "text", label: "Nama (tampil bila tanpa gambar)" }, image: imageField("Gambar logo") },
    },
  },
  resolveFields: showFields<HeroProps>({
    effect: (props) => Boolean(props.highlight?.trim()),
    image: when("variant", "split", "background", "mockup", "video"),
    image_side: when("variant", "split", "collage", "video"),
    frame: when("variant", "mockup"),
    images: when("variant", "collage"),
    video_url: when("variant", "video"),
    align: when("variant", "background"),
    proof_names: when("proof", "yes"),
    proof_rating: when("proof", "yes"),
    proof_text: when("proof", "yes"),
    logos_title: when("logos", "yes"),
    logo_items: when("logos", "yes"),
  }),
  defaultProps: {
    variant: "centered",
    badge_text: "",
    badge_link: "",
    title: "Urusan Anda selesai",
    highlight: "lebih cepat dan rapi",
    effect: "gradient",
    subtitle: "Ceritakan kebutuhan Anda; kami bantu dari awal sampai selesai.",
    primary_label: "Hubungi kami",
    primary_link: "#kontak",
    secondary_label: "",
    secondary_link: "",
    button_effect: "none",
    image: null,
    image_side: "right",
    frame: "glow",
    images: [{ image: null }, { image: null }, { image: null }, { image: null }],
    video_url: "",
    align: "left",
    proof: "no",
    // Bukti sosial dan logo mitra kosong: nama, rating, dan mitra karangan
    // terbaca sebagai fakta di halaman publik (juga saat AI mengisi dari bawaan).
    proof_names: "",
    proof_rating: 0,
    proof_text: "",
    logos: "no",
    logos_title: "Dipercaya oleh",
    logo_items: Array.from({ length: 5 }, () => ({ name: "", image: null })),
  },
  render: (props) => <HeroBlock {...props} />,
}

/**
 * Data lama: "Pembuka" (title, subtitle, button_label, button_link, image,
 * align) dan "Pembuka sorot" (HeroSpotlight). Data yang sudah baru dibiarkan.
 */
export function heroFrom(type: string, props: Record<string, unknown>): Record<string, unknown> {
  if (type === "HeroSpotlight") {
    return { ...props, variant: props.image ? "mockup" : "centered" }
  }
  if (props.variant) return props
  const { button_label, button_link, align, ...rest } = props
  return {
    ...rest,
    variant: props.image ? "split" : align === "center" ? "centered" : "split",
    primary_label: button_label ?? "",
    primary_link: button_link ?? "",
    highlight: "",
  }
}
