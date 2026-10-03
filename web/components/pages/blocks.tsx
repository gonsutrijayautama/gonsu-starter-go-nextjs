"use client"

import Image from "next/image"
import { useCallback, type ReactNode } from "react"
import { registerOverlayPortal, type PuckContext, type Slot } from "@puckeditor/core"
import { ImageIcon } from "lucide-react"
import { cn } from "cn"

import type { Site } from "@/lib/site"
import { buttonVariants } from "@/components/ui/button"

import { useSectionLayout } from "./appearance"

// Blok penyusun halaman. Komponen yang SAMA dirender editor (Puck) dan
// halaman publik, jadi yang dilihat pengelola di editor adalah yang dilihat
// pengunjung. Identitas bisnis (nama, kontak, kanal) tidak pernah diketik di
// blok: ia dibaca dari `metadata.site`, yaitu /site.json.

/** Yang diteruskan ke setiap blok lewat `puck.metadata`. */
export type BlockMetadata = {
  site: Site
  /** Alamat sungguhan untuk tautan internal ("/layanan"). Di editor: tidak ke mana-mana. */
  linkFor?: (path: string) => string
}

export type BlockProps<P> = P & { puck: PuckContext }

/** Isi slot yang dirender: Puck mengganti data slot dengan komponen ini. */
export type SlotRender = (props?: { className?: string; minEmptyHeight?: number }) => ReactNode

/** Props blok berwadah: slot `K` sudah menjadi komponen render. */
export type SlotBlockProps<P, K extends keyof P> = Omit<BlockProps<P>, K> & Record<K, SlotRender>

/**
 * Elemen yang bisa diklik langsung di editor (overlay portal Puck): tombol
 * tab dan judul buka-tutup. Tanpa ini klik di kanvas hanya memilih blok.
 * Satu ref callback boleh dipasang di banyak elemen; masing-masing dilepas
 * sendiri saat hilang.
 */
export function useOverlayPortal(puck: PuckContext) {
  const editing = puck.isEditing
  return useCallback(
    (element: HTMLElement | null) => {
      if (!editing || !element) return
      return registerOverlayPortal(element, { disableDrag: true })
    },
    [editing]
  )
}

function metadataOf(puck: PuckContext): BlockMetadata {
  return puck.metadata as BlockMetadata
}

/** Tautan dari isian blok: internal ("/…"), jangkar ("#…"), atau https. Selain itu tidak ditaut. */
export function resolveLink(href: string, puck: PuckContext): string | undefined {
  const link = href.trim()
  if (!link) return undefined
  if (link.startsWith("#")) return link
  if (link.startsWith("/")) return metadataOf(puck).linkFor?.(link) ?? link
  if (/^https:\/\/[^\s]+$/.test(link)) return link
  return undefined
}

/*
 * Tata letak elemen. Elemen yang diletakkan langsung di halaman mendapat
 * lebar dan jarak tepi yang sama dengan bagian siap pakai. Di dalam wadah
 * (Bagian, Kolom, Kisi, Kartu, Baris), wadahnya yang mengatur: ia mengganti
 * variabel ini untuk isinya. Elemen selalu punya pembungkus `div` sendiri,
 * supaya susunannya sama di editor (yang membungkus setiap blok) dan di
 * halaman publik.
 */
export const pageVars = "[--el-max:72rem] [--el-px:1rem] sm:[--el-px:1.5rem] [--el-py:0.5rem] [--el-w:100%] [--el-mx:auto]"
/** Wadah yang menyusun isinya bertumpuk (Bagian, Kolom, Kisi, Kartu). */
export const stackVars = "[--el-max:none] [--el-px:0px] [--el-py:0px] [--el-w:100%] [--el-mx:0px]"
/** Baris: isinya berjajar seukuran isinya. */
export const rowVars = "[--el-max:none] [--el-px:0px] [--el-py:0px] [--el-w:auto] [--el-mx:0px]"
export const elementFrame = "mx-(--el-mx) w-(--el-w) max-w-(--el-max) px-(--el-px) py-(--el-py)"

/** Gaya teks kaya (paragraf, daftar, tautan) dari isian teks kaya Puck. */
export const richText =
  "flex flex-col gap-4 text-pretty [&_a]:text-foreground [&_a]:underline [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-foreground [&_ol]:list-decimal [&_ol]:pl-6 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-6"

export function Section({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  // Lebar dan jarak dari Tampilan bagian, terakhir supaya menang atas bawaan blok.
  const layout = useSectionLayout()
  return (
    <section id={id} className={cn("mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-10 sm:px-6 lg:py-14", className, layout.className)} style={layout.style}>
      {children}
    </section>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="page-title text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{children}</h2>
}

/** Gambar blok. Kosong: tidak dirender bagi pengunjung, tempatnya ditandai di editor. */
export function BlockImage({ src, alt, className, puck }: { src: string | null; alt: string; className?: string; puck: PuckContext }) {
  if (!src) {
    if (!puck.isEditing) return null
    return (
      <div
        className={cn("flex items-center justify-center rounded-xl border border-dashed border-muted-foreground/40 bg-muted text-muted-foreground", className)}
      >
        <ImageIcon aria-hidden="true" className="size-6" />
      </div>
    )
  }
  return (
    <div className={cn("relative overflow-hidden rounded-xl border bg-muted", className)}>
      <Image src={src} alt={alt} fill unoptimized className="object-cover" />
    </div>
  )
}

export function LinkButton({
  label,
  href,
  variant,
  effect,
  puck,
}: {
  label: string
  href: string
  variant: "default" | "secondary" | "outline"
  /** Kelas efek tombol (effects.tsx), bila ada. */
  effect?: string
  puck: PuckContext
}) {
  const target = resolveLink(href, puck)
  if (!label.trim() || !target) return null
  return (
    // Di editor tautan tidak dibuka: klik memilih blok, bukan meninggalkan kanvas.
    <a href={puck.isEditing ? undefined : target} className={cn(buttonVariants({ variant }), effect)}>
      {label}
    </a>
  )
}

// --- Kolom ---------------------------------------------------------------------

type ColumnSlot = "first" | "second" | "third" | "fourth" | "fifth" | "sixth"

export type ColumnsProps = {
  count: "1" | "2" | "3" | "4" | "5" | "6"
  /** Perbandingan lebar, hanya untuk dua kolom. */
  ratio: "equal" | "1-2" | "2-1" | "1-3" | "3-1"
  gap: "small" | "medium" | "large"
  valign: "top" | "center" | "bottom"
} & Record<ColumnSlot, Slot>

// Kelas Tailwind harus tertulis utuh, jadi setiap pilihan dipetakan ke kelasnya.
const columnsClass: Record<ColumnsProps["count"], string> = {
  "1": "",
  "2": "md:grid-cols-2",
  "3": "md:grid-cols-3",
  "4": "sm:grid-cols-2 lg:grid-cols-4",
  "5": "sm:grid-cols-2 lg:grid-cols-5",
  "6": "sm:grid-cols-3 lg:grid-cols-6",
}
const ratioClass: Record<ColumnsProps["ratio"], string> = {
  equal: "",
  "1-2": "md:grid-cols-[1fr_2fr]",
  "2-1": "md:grid-cols-[2fr_1fr]",
  "1-3": "md:grid-cols-[1fr_3fr]",
  "3-1": "md:grid-cols-[3fr_1fr]",
}
export const gapClass = { small: "gap-4", medium: "gap-6", large: "gap-8 lg:gap-14" } as const
const alignItemsClass = { top: "items-start", center: "items-center", bottom: "items-end" } as const

export function ColumnsBlock(props: SlotBlockProps<ColumnsProps, ColumnSlot>) {
  const { count, ratio, gap, valign } = props
  const total = Number(count) || 2
  const columns = [props.first, props.second, props.third, props.fourth, props.fifth, props.sixth].slice(0, total)
  return (
    <div
      className={cn(
        elementFrame,
        "grid",
        columnsClass[count] ?? columnsClass["2"],
        total === 2 && ratio ? ratioClass[ratio] : "",
        gapClass[gap] ?? gapClass.medium,
        alignItemsClass[valign] ?? ""
      )}
    >
      {columns.map((Column, index) =>
        Column ? (
          <div key={index} className={cn(stackVars, "min-w-0")}>
            <Column className="flex flex-col gap-4" minEmptyHeight={120} />
          </div>
        ) : null
      )}
    </div>
  )
}

// --- Spasi --------------------------------------------------------------------

export type SpacerProps = { size: "small" | "medium" | "large"; line: "yes" | "no" }

export function SpacerBlock({ size, line }: BlockProps<SpacerProps>) {
  const height = { small: "h-6", medium: "h-12", large: "h-24" }[size]
  return (
    <div aria-hidden="true" className={cn(elementFrame, "flex items-center py-0", height)}>
      {line === "yes" ? <hr className="w-full border-border" /> : null}
    </div>
  )
}
