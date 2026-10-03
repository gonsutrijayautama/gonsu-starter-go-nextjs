"use client"

import type { ComponentConfig } from "@puckeditor/core"
import { cn } from "cn"

import { ColorScope } from "../appearance"
import { BlockImage, Section, stackVars, type BlockProps } from "../blocks"
import { DeviceFrame, HighlightText, type ButtonEffect, type TextEffect } from "../effects"
import { VideoBlock } from "../extras"
import { buttonEffectField, effectField, imageField, layoutField, linkField, showFields, sk, when, yesNoField } from "../fields"
import { AnnouncementPill, Buttons, Logo, PeopleStack, Stars } from "./kit"

// Pembuka halaman: satu blok dengan beberapa susunan. Menggantikan "Pembuka"
// dan "Pembuka sorot" lama (lihat `heroFrom` untuk data lama).

export type HeroProps = {
  variant: "centered" | "split" | "background" | "mockup" | "collage" | "video"
  badge_text: string
  badge_link: string
  title: string
  highlight: string
  effect: TextEffect
  subtitle: string
  primary_label: string
  primary_link: string
  secondary_label: string
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
  proof_text: string
  proof_rating: number
  logos: "yes" | "no"
  logos_title: string
  logo_items: { name: string; image: string | null }[]
}

function Copy({ props, center, large }: { props: BlockProps<HeroProps>; center: boolean; large?: boolean }) {
  const { badge_text, badge_link, title, highlight, effect, subtitle, puck } = props
  return (
    <div className={cn("flex flex-col gap-6", center ? "items-center text-center" : "items-start")}>
      {badge_text ? <AnnouncementPill text={badge_text} link={badge_link} puck={puck} /> : null}
      <h1
        className={cn(
          "page-title font-semibold tracking-tighter text-balance",
          large ? "max-w-4xl text-4xl leading-[1.05] sm:text-6xl" : "text-4xl leading-[1.06] sm:text-5xl lg:text-[3.5rem]"
        )}
      >
        {title}
        {/* Kata yang disorot di baris sendiri, seperti pembuka Launch UI. */}
        {highlight ? (
          <span className="block">
            <HighlightText text={highlight} effect={effect} />
          </span>
        ) : null}
      </h1>
      {subtitle ? <p className={cn("page-lead max-w-2xl text-lg text-pretty text-muted-foreground", large && "sm:text-xl")}>{subtitle}</p> : null}
      <Buttons
        primary={{ label: props.primary_label, link: props.primary_link }}
        secondary={{ label: props.secondary_label, link: props.secondary_link }}
        effect={props.button_effect}
        align={center ? "center" : "left"}
        puck={puck}
      />
      {props.proof === "yes" ? (
        <div className={cn("flex flex-wrap items-center gap-3", center && "justify-center")}>
          <PeopleStack names={props.proof_names} />
          <div className="flex flex-col gap-0.5 text-sm">
            {props.proof_rating > 0 ? (
              <span className="flex items-center gap-1.5">
                <Stars value={props.proof_rating} />
                <span className="font-medium tabular-nums">{props.proof_rating.toLocaleString("id-ID")}</span>
              </span>
            ) : null}
            {props.proof_text ? <span className="text-muted-foreground">{props.proof_text}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function LogoRow({ props }: { props: HeroProps }) {
  const logos = props.logo_items.filter((item) => item.name.trim() || item.image)
  if (props.logos !== "yes" || logos.length === 0) return null
  return (
    <div className="flex flex-col gap-5 pt-12">
      {props.logos_title ? <p className="text-center text-sm font-medium text-muted-foreground">{props.logos_title}</p> : null}
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
        {logos.map((item, index) => (
          <Logo key={index} name={item.name} image={item.image} />
        ))}
      </div>
    </div>
  )
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
        <VideoBlock url={props.video_url} title={props.title} thumbnail={image} style="dialog" frame="none" puck={puck} />
      </div>
    )
  }
  if (!image && !puck.isEditing) return null
  return <BlockImage src={image} alt="" className="aspect-4/3 w-full rounded-2xl shadow-xl" puck={puck} />
}

export function HeroBlock(props: BlockProps<HeroProps>) {
  const { variant, image, puck } = props

  if (variant === "background") {
    const center = props.align === "center"
    return (
      <Section>
        <ColorScope
          background="inverse"
          className={cn(
            "relative isolate flex min-h-[32rem] flex-col overflow-hidden rounded-3xl px-6 py-14 sm:px-12 lg:min-h-[38rem] lg:py-20",
            center ? "justify-center" : "justify-end"
          )}
        >
          {image || puck.isEditing ? (
            <div aria-hidden="true" className="absolute inset-0 -z-10">
              <BlockImage src={image} alt="" className="size-full rounded-none border-0" puck={puck} />
              <div className={cn("absolute inset-0", center ? "bg-black/55" : "bg-linear-to-t from-black/80 via-black/45 to-black/10")} />
            </div>
          ) : null}
          <div className={cn("max-w-3xl", center && "mx-auto")}>
            <Copy props={props} center={center} large />
          </div>
        </ColorScope>
        <LogoRow props={props} />
      </Section>
    )
  }

  if (variant === "split" || variant === "collage" || variant === "video") {
    const media = <Media props={props} />
    return (
      <Section className="pt-12 lg:pt-20">
        <div className={cn("grid items-center gap-12", (image || puck.isEditing || variant !== "split") && "lg:grid-cols-2 lg:gap-16")}>
          <div className={cn(props.image_side === "left" && "lg:order-2")}>
            <Copy props={props} center={false} />
          </div>
          {media}
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
              />
            </DeviceFrame>
          ) : (
            <div className="rounded-2xl border bg-card/60 p-2 shadow-2xl backdrop-blur">
              <BlockImage src={image} alt="" className="aspect-video w-full" puck={puck} />
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
    badge_text: { type: "text", label: "Pengumuman kecil di atas judul", placeholder: "Kosongkan bila tidak perlu" },
    badge_link: { type: "text", label: "Tautan pengumuman", placeholder: "/layanan, #kontak, atau https://…" },
    title: { type: "textarea", label: "Judul besar" },
    highlight: { type: "text", label: "Kata yang disorot", placeholder: "Untuk efek berganti: rapi, cepat, terjangkau" },
    effect: effectField,
    subtitle: { type: "textarea", label: "Kalimat di bawahnya" },
    primary_label: { type: "text", label: "Tombol utama", placeholder: "Kosongkan bila tanpa tombol" },
    primary_link: linkField,
    secondary_label: { type: "text", label: "Tombol kedua", placeholder: "Kosongkan bila tanpa tombol kedua" },
    secondary_link: { ...linkField, label: "Tautan tombol kedua" },
    button_effect: buttonEffectField,
    image: imageField("Gambar"),
    image_side: {
      type: "radio",
      label: "Letak teks",
      options: [
        { label: "Teks di kiri", value: "right" },
        { label: "Teks di kanan", value: "left" },
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
    video_url: { type: "text", label: "Tautan video YouTube", placeholder: "https://youtu.be/…" },
    align: {
      type: "radio",
      label: "Letak teks",
      options: [
        { label: "Kiri bawah", value: "left" },
        { label: "Tengah", value: "center" },
      ],
    },
    proof: yesNoField("Bukti sosial (foto pelanggan dan rating)"),
    proof_names: { type: "text", label: "Nama pelanggan untuk foto (pisahkan dengan koma)" },
    proof_rating: { type: "number", label: "Rating (0 = tanpa bintang)", min: 0, max: 5, step: 0.1 },
    proof_text: { type: "text", label: "Kalimat bukti", placeholder: "Dipercaya 500+ pelanggan" },
    logos: yesNoField("Logo mitra di bawah"),
    logos_title: { type: "text", label: "Kalimat di atas logo" },
    logo_items: {
      type: "array",
      label: "Logo",
      max: 12,
      getItemSummary: (item) => item.name || "Logo tanpa nama",
      defaultItemProps: { name: "Nama mitra", image: null },
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
    subtitle: "Satu-dua kalimat yang menjelaskan apa yang Anda tawarkan dan untuk siapa.",
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
    proof_names: "Sari, Budi, Rina, Agus",
    proof_rating: 4.9,
    proof_text: "Dipercaya 500+ pelanggan",
    logos: "no",
    logos_title: "Dipercaya oleh",
    logo_items: ["Maju Bersama", "Sumber Rejeki", "Karya Mandiri", "Sinar Abadi", "Berkah Jaya"].map((name) => ({ name, image: null })),
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
