"use client"

import Image from "next/image"
import type { PuckContext } from "@puckeditor/core"
import { ArrowRightIcon, StarIcon } from "lucide-react"
import { cn } from "cn"

import { Badge } from "@/components/reui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

import { LinkButton, resolveLink, SectionTitle } from "../blocks"
import { buttonEffectClass, type ButtonEffect } from "../effects"
import { initials } from "../elements"
import { dicebearAvatar } from "../extras"

// Bagian kecil yang dipakai bersama oleh blok siap pakai (library/*).

/** Pengantar bagian: label kecil, judul, dan kalimat di bawahnya. */
export function SectionIntro({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className,
}: {
  eyebrow?: string
  title?: string
  subtitle?: string
  align?: "center" | "left"
  className?: string
}) {
  if (!eyebrow && !title && !subtitle) return null
  const center = align === "center"
  return (
    <div className={cn("flex flex-col gap-3", center ? "mx-auto max-w-2xl items-center text-center" : "max-w-2xl items-start", className)}>
      {eyebrow ? (
        <Badge variant="outline" radius="full">
          {eyebrow}
        </Badge>
      ) : null}
      {title ? <SectionTitle>{title}</SectionTitle> : null}
      {subtitle ? <p className="page-lead text-lg text-pretty text-muted-foreground">{subtitle}</p> : null}
    </div>
  )
}

/** Teks dari isian berbaris banyak, satu butir per baris. */
export function lines(text: string | undefined): string[] {
  return (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Kelas kisi menurut jumlah butir: kelas Tailwind harus tertulis utuh. */
export function columnsFor(count: number): string {
  if (count <= 1) return ""
  if (count === 2) return "md:grid-cols-2"
  if (count === 4) return "md:grid-cols-2 lg:grid-cols-4"
  return "md:grid-cols-2 lg:grid-cols-3"
}

/** Logo mitra: gambar, atau namanya bila tanpa gambar. `grayscale`: berwarna saat disorot. */
export function Logo({ name, image, grayscale = true }: { name: string; image: string | null; grayscale?: boolean }) {
  if (image) {
    return (
      <Image
        src={image}
        alt={name}
        width={160}
        height={48}
        unoptimized
        className={cn("h-9 w-auto shrink-0 object-contain transition", grayscale && "opacity-70 grayscale hover:opacity-100 hover:grayscale-0")}
      />
    )
  }
  return <span className="flex h-9 shrink-0 items-center text-lg font-semibold tracking-tight whitespace-nowrap text-muted-foreground">{name}</span>
}

/** Bintang nilai (0–5), bisa pecahan. Warna bintang dari token peringatan. */
export function Stars({ value, className }: { value: number; className?: string }) {
  const rounded = Math.round(Math.max(0, Math.min(5, value)) * 2) / 2
  return (
    <span role="img" aria-label={`${rounded.toLocaleString("id-ID")} dari 5 bintang`} className={cn("flex items-center gap-0.5 text-warning", className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className="relative inline-flex">
          <StarIcon aria-hidden="true" className="size-4 text-muted-foreground/30" fill="currentColor" strokeWidth={0} />
          {rounded >= star - 0.5 ? (
            <span className={cn("absolute inset-0 overflow-hidden", rounded < star && "w-1/2")}>
              <StarIcon aria-hidden="true" className="size-4" fill="currentColor" strokeWidth={0} />
            </span>
          ) : null}
        </span>
      ))}
    </span>
  )
}

/** Foto orang: unggahan, atau avatar DiceBear dari namanya, atau inisial. */
export function Person({ name, image, className }: { name: string; image?: string | null; className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarImage src={image || dicebearAvatar(name)} alt="" />
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  )
}

/** Tumpukan avatar dari daftar nama (dipisah koma). */
export function PeopleStack({ names, className }: { names: string; className?: string }) {
  const people = names
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 5)
  if (people.length === 0) return null
  return (
    <span className={cn("flex -space-x-2", className)}>
      {people.map((name) => (
        <Person key={name} name={name} className="size-8 ring-2 ring-background" />
      ))}
    </span>
  )
}

/** Tombol utama dan kedua. Tombol tanpa teks atau tautan tidak dirender. */
export function Buttons({
  primary,
  secondary,
  effect = "none",
  align = "left",
  puck,
  className,
}: {
  primary: { label: string; link: string }
  secondary?: { label: string; link: string }
  effect?: ButtonEffect
  align?: "left" | "center"
  puck: PuckContext
  className?: string
}) {
  const shown = (primary.label.trim() && resolveLink(primary.link, puck)) || (secondary?.label.trim() && resolveLink(secondary.link, puck))
  if (!shown) return null
  return (
    <div className={cn("flex flex-wrap gap-3", align === "center" && "justify-center", className)}>
      <LinkButton label={primary.label} href={primary.link} variant="default" effect={buttonEffectClass[effect]} puck={puck} />
      {secondary ? <LinkButton label={secondary.label} href={secondary.link} variant="outline" puck={puck} /> : null}
    </div>
  )
}

/** Pengumuman kecil berbentuk kapsul di atas judul pembuka. */
export function AnnouncementPill({ text, link, puck }: { text: string; link: string; puck: PuckContext }) {
  const target = resolveLink(link, puck)
  const content = (
    <>
      <span className="text-muted-foreground">{text}</span>
      {target ? <ArrowRightIcon aria-hidden="true" className="size-3.5 transition-transform group-hover:translate-x-0.5" /> : null}
    </>
  )
  const style = "group inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-sm shadow-xs backdrop-blur"
  if (!target) return <span className={style}>{content}</span>
  return (
    <a href={puck.isEditing ? undefined : target} className={cn(style, "transition-colors hover:bg-accent")}>
      {content}
    </a>
  )
}
