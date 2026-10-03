"use client"

import type { CSSProperties, ReactNode } from "react"
import type { Slot } from "@puckeditor/core"
import { CheckIcon, CircleAlertIcon, CircleCheckIcon, InfoIcon, PlusIcon, TriangleAlertIcon } from "lucide-react"
import { cn } from "cn"

import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert"
import { Badge } from "@/components/reui/badge"
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame"
import { IconTile } from "@/components/reui/icon-tile"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import {
  BlockImage,
  gapClass,
  Section,
  elementFrame,
  resolveLink,
  richText,
  rowVars,
  stackVars,
  useOverlayPortal,
  type BlockProps,
  type SlotBlockProps,
  type SlotRender,
} from "./blocks"
import { PageIcon } from "./page-icon"
import { StatNumber, statOf, type NumberFormat, type StatValue } from "./stat-number"
import { buttonEffectClass, DeviceFrame, EffectFrame, type ButtonEffect, type CardEffect, type DeviceKind } from "./effects"

// Komponen dasar penyusun halaman: wadah, elemen, dan komponen. Semuanya
// dirender dengan komponen UI aplikasi (shadcn dan ReUI), jadi tombol, label,
// kartu, dan lainnya di halaman sama persis dengan yang ada di aplikasi.

export type Align = "left" | "center" | "right"

/** Ikon dari daftar ikon situs menurut namanya. */
function SiteIcon({ name }: { name: string }) {
  return <PageIcon name={name} />
}

const textAlign: Record<Align, string> = { left: "text-left", center: "text-center", right: "text-right" }
const justify: Record<Align, string> = { left: "justify-start", center: "justify-center", right: "justify-end" }

// === Wadah =====================================================================

export type SectionProps = { content: Slot }

/** Bagian kosong selebar halaman: tempat menyusun elemen sendiri. Latar dan lebarnya di Tampilan bagian. */
export function SectionBlock({ content }: SlotBlockProps<SectionProps, "content">) {
  return <Section>{content({ className: cn(stackVars, "flex flex-col gap-5"), minEmptyHeight: 120 })}</Section>
}

export type RowProps = { justify: "start" | "center" | "end" | "between"; items: Slot }

/** Isi berjajar ke samping, misalnya dua tombol atau beberapa label. */
export function RowBlock({ justify: place, items }: SlotBlockProps<RowProps, "items">) {
  const placement = { start: "justify-start", center: "justify-center", end: "justify-end", between: "justify-between" }[place]
  return <div className={elementFrame}>{items({ className: cn(rowVars, "flex flex-wrap items-center gap-3", placement), minEmptyHeight: 48 })}</div>
}

export type GridProps = {
  columns: "1" | "2" | "3" | "4" | "5" | "6"
  /** Kolom di ponsel. */
  mobile: "1" | "2"
  gap: "small" | "medium" | "large"
  items: Slot
}

const gridClass: Record<GridProps["columns"], string> = {
  "1": "",
  "2": "sm:grid-cols-2",
  "3": "sm:grid-cols-2 lg:grid-cols-3",
  "4": "sm:grid-cols-2 lg:grid-cols-4",
  "5": "sm:grid-cols-3 lg:grid-cols-5",
  "6": "sm:grid-cols-3 lg:grid-cols-6",
}

/** Kisi: isinya mengalir ke beberapa kolom yang sama lebar, dan bertumpuk di ponsel. */
export function GridBlock({ columns, mobile, gap, items }: SlotBlockProps<GridProps, "items">) {
  return (
    <div className={elementFrame}>
      {items({
        className: cn(stackVars, "grid", mobile === "2" ? "grid-cols-2" : "grid-cols-1", gridClass[columns] ?? gridClass["3"], gapClass[gap] ?? gapClass.small),
        minEmptyHeight: 120,
      })}
    </div>
  )
}

export type CardProps = { title: string; description: string; style: "card" | "frame"; effect: CardEffect; content: Slot }

/** Kartu: judul, keterangan, dan isi bebas. "Bingkai" memakai Frame ReUI, seperti kartu di aplikasi. */
export function CardBlock({ title, description, style, effect, content }: SlotBlockProps<CardProps, "content">) {
  const body = content({ className: cn(stackVars, "flex flex-col gap-4"), minEmptyHeight: 64 })
  if (style === "frame") {
    return (
      <div className={cn(elementFrame, "h-full")}>
        <EffectFrame effect={effect} className="h-full rounded-xl">
          <Frame className="h-full">
            {title || description ? (
              <FrameHeader>
                {title ? <FrameTitle>{title}</FrameTitle> : null}
                {description ? <FrameDescription>{description}</FrameDescription> : null}
              </FrameHeader>
            ) : null}
            <FramePanel>{body}</FramePanel>
          </Frame>
        </EffectFrame>
      </div>
    )
  }
  return (
    <div className={cn(elementFrame, "h-full")}>
      <EffectFrame effect={effect} className="h-full rounded-xl">
        <div className="flex h-full flex-col gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-xs">
          {title || description ? (
            <div className="flex flex-col gap-1.5">
              {title ? <h3 className="leading-none font-semibold">{title}</h3> : null}
              {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
            </div>
          ) : null}
          {body}
        </div>
      </EffectFrame>
    </div>
  )
}

// === Elemen ====================================================================

/** Gaya huruf kustom elemen teks: ukuran (px, 0 = bawaan), tebal, dan warna (#rrggbb, kosong = otomatis). */
type TextStyle = { font_size: number; color: string }
const weightClass = { default: "", normal: "font-normal", medium: "font-medium", semibold: "font-semibold", bold: "font-bold" } as const

/** Gaya langsung untuk ukuran dan warna kustom; judul besar dibatasi lebar layar supaya muat di ponsel. */
function textStyle({ font_size, color }: Partial<TextStyle>, shrink = false, limit = "11vw"): CSSProperties | undefined {
  const style: CSSProperties = {}
  if (font_size && font_size > 0) style.fontSize = shrink ? `min(${font_size}px, ${limit})` : `${font_size}px`
  if (color && /^#[0-9a-f]{6}$/i.test(color)) style.color = color
  return Object.keys(style).length > 0 ? style : undefined
}

export type HeadingProps = TextStyle & { text: string; level: "h1" | "h2" | "h3" | "h4"; weight: keyof typeof weightClass; align: Align }

const headingSize = {
  h1: "text-4xl leading-[1.06] font-semibold tracking-tighter sm:text-5xl",
  h2: "text-3xl font-semibold tracking-tight sm:text-4xl",
  h3: "text-2xl font-semibold tracking-tight",
  h4: "text-lg font-semibold",
}

export function HeadingBlock({ text, level, weight, align, font_size, color }: BlockProps<HeadingProps>) {
  const Tag = level
  return (
    <div className={cn(elementFrame, textAlign[align])}>
      <Tag className={cn(headingSize[level], weightClass[weight], "text-balance", font_size > 0 && "leading-[1.08]")} style={textStyle({ font_size, color }, true)}>
        {text}
      </Tag>
    </div>
  )
}

export type ParagraphProps = TextStyle & { text: ReactNode; size: "small" | "normal" | "large"; tone: "muted" | "normal"; align: Align }

export function ParagraphBlock({ text, size, tone, align, font_size, color }: BlockProps<ParagraphProps>) {
  const fontSize = { small: "text-sm", normal: "text-base", large: "text-lg" }[size]
  return (
    <div className={cn(elementFrame, richText, fontSize, tone === "muted" && "text-muted-foreground", textAlign[align])} style={textStyle({ font_size, color })}>
      {text}
    </div>
  )
}

export type ButtonProps = {
  label: string
  link: string
  variant: "default" | "secondary" | "outline" | "ghost" | "link" | "destructive" | "dashed" | "mono" | "soft" | "gradient"
  /** Ikon lucide; kosong = tanpa ikon. */
  icon: string
  icon_position: "left" | "right" | "only"
  shape: "default" | "pill" | "square"
  shadow: "no" | "yes"
  new_tab: "no" | "yes"
  align: Align
  effect: ButtonEffect
  size: "sm" | "md" | "lg" | "xl"
  width: "auto" | "full" | "custom"
  /** Lebar "custom", piksel. */
  width_px: number
}

// Ukuran tombol halaman. "lg" dan "xl" lebih besar dari ukuran tombol aplikasi
// (yang dibuat untuk formulir), karena tombol di halaman adalah ajakan utama.
const buttonSize = {
  sm: { variant: "sm", extra: "" },
  md: { variant: "default", extra: "" },
  lg: { variant: "default", extra: "h-10 px-4 text-base" },
  xl: { variant: "default", extra: "h-12 rounded-xl px-6 text-base" },
} as const

// Gaya tombol di luar varian Button aplikasi (pola tombol ReUI). Dasarnya
// varian "default" atau "outline", lalu warnanya diganti.
const extraVariant = {
  dashed: { base: "outline", extra: "border-dashed" },
  mono: { base: "default", extra: "bg-foreground text-background hover:bg-foreground/90" },
  soft: { base: "secondary", extra: "bg-primary/10 text-primary hover:bg-primary/15 dark:bg-primary/20 dark:text-foreground" },
  gradient: { base: "default", extra: "border-0 bg-linear-to-r from-primary to-(--page-accent) hover:opacity-90" },
} as const

export function ButtonBlock({ label, link, variant, icon, icon_position, shape, shadow, new_tab, align, effect, size, width, width_px, puck }: BlockProps<ButtonProps>) {
  const target = resolveLink(link, puck)
  // Tombol tanpa tautan yang sah tidak berguna bagi pengunjung; di editor tetap
  // tampil supaya bisa diisi.
  if (!label.trim() || (!target && !puck.isEditing)) return null
  const extra = variant in extraVariant ? extraVariant[variant as keyof typeof extraVariant] : null
  const iconOnly = Boolean(icon) && icon_position === "only"
  return (
    <div className={cn(elementFrame, "flex", justify[align])}>
      <a
        href={puck.isEditing ? undefined : target}
        target={new_tab === "yes" ? "_blank" : undefined}
        rel={new_tab === "yes" ? "noreferrer" : undefined}
        aria-label={iconOnly ? label : undefined}
        className={cn(
          buttonVariants({
            variant: extra ? extra.base : (variant as "default" | "secondary" | "outline" | "ghost" | "link" | "destructive"),
            size: (buttonSize[size] ?? buttonSize.md).variant,
          }),
          (buttonSize[size] ?? buttonSize.md).extra,
          extra?.extra,
          shape === "pill" && "rounded-full",
          shape === "square" && "rounded-none",
          shadow === "yes" && "shadow-md",
          iconOnly && "aspect-square px-0",
          buttonEffectClass[effect],
          width === "full" && "w-full"
        )}
        style={width === "custom" && width_px > 0 && !iconOnly ? { width: width_px, maxWidth: "100%" } : undefined}
      >
        {icon && (icon_position === "left" || iconOnly) ? <PageIcon name={icon} /> : null}
        {iconOnly ? null : label}
        {icon && icon_position === "right" ? <PageIcon name={icon} /> : null}
      </a>
    </div>
  )
}

export type BadgeProps = {
  text: string
  variant: "default" | "secondary" | "outline" | "success-light" | "warning-light" | "info-light"
  shape: "rounded" | "pill"
  align: Align
}

export function BadgeBlock({ text, variant, shape, align }: BlockProps<BadgeProps>) {
  if (!text.trim()) return null
  return (
    <div className={cn(elementFrame, "flex", justify[align])}>
      <Badge variant={variant} radius={shape === "pill" ? "full" : "default"}>
        {text}
      </Badge>
    </div>
  )
}

export type ImageProps = { image: string | null; alt: string; ratio: "16/9" | "4/3" | "1/1" | "3/4"; frame: DeviceKind; caption: string }

export function ImageBlock({ image, alt, ratio, frame, caption, puck }: BlockProps<ImageProps>) {
  if (!image && !puck.isEditing) return null
  // Bingkai ponsel selalu tegak, apa pun bentuk yang dipilih.
  const aspect = frame === "phone" ? "aspect-[9/19]" : { "16/9": "aspect-video", "4/3": "aspect-4/3", "1/1": "aspect-square", "3/4": "aspect-3/4" }[ratio]
  const framed = frame === "browser" || frame === "phone"
  return (
    <figure className={cn(elementFrame, "flex flex-col gap-2")}>
      <DeviceFrame kind={frame}>
        <BlockImage src={image} alt={alt} className={cn(aspect, "w-full", framed && "rounded-none border-0")} puck={puck} />
      </DeviceFrame>
      {caption ? <figcaption className="text-sm text-muted-foreground">{caption}</figcaption> : null}
    </figure>
  )
}

export type IconProps = { icon: string; style: "outline" | "solid" | "frame"; align: Align }

export function IconBlock({ icon, style, align }: BlockProps<IconProps>) {
  return (
    <div className={cn(elementFrame, "flex", justify[align])}>
      <IconTile variant={style} size="lg" aria-hidden="true">
        <SiteIcon name={icon} />
      </IconTile>
    </div>
  )
}

export type ListProps = { style: "check" | "bullet" | "number"; items: { text: string }[] }

export function ListBlock({ style, items }: BlockProps<ListProps>) {
  const filled = items.filter((item) => item.text.trim())
  if (style === "check") {
    return (
      <ul className={cn(elementFrame, "flex flex-col gap-2.5")}>
        {filled.map((item, index) => (
          <li key={index} className="flex items-start gap-2.5">
            <CheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
            <span className="text-pretty">{item.text}</span>
          </li>
        ))}
      </ul>
    )
  }
  const Tag = style === "number" ? "ol" : "ul"
  return (
    <Tag className={cn(elementFrame, "flex flex-col gap-2 pl-[calc(var(--el-px)+1.5rem)]", style === "number" ? "list-decimal" : "list-disc")}>
      {filled.map((item, index) => (
        <li key={index} className="text-pretty">
          {item.text}
        </li>
      ))}
    </Tag>
  )
}

export type DividerProps = {
  style: "solid" | "dashed" | "dotted" | "double" | "gradient" | "fade"
  thickness: number
  /** #rrggbb; kosong = warna garis tema. */
  color: string
  length: "full" | "half" | "short"
  text: string
  icon: string
  position: "left" | "center" | "right"
  label_style: "plain" | "pill"
}

/** Garis pemisah: beberapa gaya garis, boleh dengan teks atau ikon di kiri, tengah, atau kanan. */
export function DividerBlock({ style, thickness, color, length, text, icon, position, label_style }: BlockProps<DividerProps>) {
  const tone = /^#[0-9a-f]{6}$/i.test(color ?? "") ? color : "var(--border)"
  const size = Math.min(Math.max(thickness || 1, 1), 8)
  // Satu sisi garis. "fade": memudar menjauhi teks; "gradient": memudar di kedua ujung.
  const line = (side: "before" | "after" | "alone") => {
    if (style === "gradient" || style === "fade") {
      const direction = side === "before" ? "to left" : "to right"
      const background =
        style === "gradient" && side === "alone"
          ? `linear-gradient(to right, transparent, ${tone}, transparent)`
          : `linear-gradient(${direction}, ${tone}, transparent)`
      return <span aria-hidden="true" className="min-w-6 flex-1 rounded-full" style={{ height: size, background }} />
    }
    return (
      <span
        aria-hidden="true"
        className="min-w-6 flex-1"
        style={{ borderTopWidth: style === "double" ? Math.max(size, 3) : size, borderTopStyle: style, borderColor: tone }}
      />
    )
  }
  const hasLabel = Boolean(text?.trim() || icon)
  const label = hasLabel ? (
    <span
      className={cn(
        "flex shrink-0 items-center gap-2 text-sm text-muted-foreground",
        label_style === "pill" && "rounded-full border bg-background px-3 py-1 font-medium text-foreground"
      )}
    >
      {icon ? <PageIcon name={icon} className="size-4" /> : null}
      {text?.trim() ? <span>{text}</span> : null}
    </span>
  ) : null
  const lengthClass = { full: "w-full", half: "mx-auto w-1/2", short: "mx-auto w-32" }[length] ?? "w-full"
  return (
    <div className={elementFrame}>
      <div role="separator" aria-label={text?.trim() || undefined} className={cn("flex items-center gap-3", lengthClass)}>
        {!label ? line("alone") : null}
        {label && position !== "left" ? line("before") : null}
        {label}
        {label && position !== "right" ? line("after") : null}
      </div>
    </div>
  )
}

// === Komponen ==================================================================

export type AlertProps = { variant: "default" | "info" | "success" | "warning" | "destructive"; title: string; description: string }

const alertIcons = { default: InfoIcon, info: InfoIcon, success: CircleCheckIcon, warning: TriangleAlertIcon, destructive: CircleAlertIcon }

export function AlertBlock({ variant, title, description }: BlockProps<AlertProps>) {
  const Icon = alertIcons[variant]
  return (
    <div className={elementFrame}>
      {/* Pengumuman di halaman bukan galat yang mendesak: tanpa role="alert". */}
      <Alert variant={variant} role="note">
        <Icon aria-hidden="true" />
        {title ? <AlertTitle>{title}</AlertTitle> : null}
        {description ? <AlertDescription>{description}</AlertDescription> : null}
      </Alert>
    </div>
  )
}

/** Isi tambahan yang bisa disusun di dalam butir: slot yang sudah dirender Puck. */
type WithBody<T> = Omit<T, "body"> & { body?: SlotRender }

export type AccordionItemData = { title: string; icon: string; content: string; body: Slot }

export type AccordionProps = {
  variant: "plain" | "boxed" | "separated" | "solid" | "shadow"
  /** Penanda buka-tutup di ujung judul. */
  indicator: "chevron" | "plus" | "none"
  /** Beberapa butir boleh terbuka bersamaan. */
  multiple: "yes" | "no"
  /** Butir yang terbuka saat halaman dibuka (dan yang dibuka di editor); 0 = semua tertutup. */
  open: number
  items: AccordionItemData[]
}

// Variasi buka-tutup mengikuti contoh ReUI: polos, satu kotak, kotak terpisah,
// berlatar (solid), dan kartu berbayang.
const accordionStyle = {
  plain: { root: "", item: "" },
  boxed: { root: "rounded-xl border bg-card px-5", item: "" },
  separated: { root: "gap-3", item: "rounded-xl border bg-card px-5 not-last:border-b" },
  solid: { root: "gap-2", item: "rounded-xl bg-muted px-5 not-last:border-b-0" },
  shadow: { root: "gap-3", item: "rounded-xl border bg-card px-5 shadow-sm not-last:border-b data-open:shadow-md" },
}

/** Isi satu butir: teks, lalu komponen lain yang disusun di dalamnya. */
function ItemBody({ content, body, editing }: { content: string; body?: SlotRender; editing: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {content ? <p className="whitespace-pre-line text-pretty text-muted-foreground">{content}</p> : null}
      {/* Di halaman terbit wadah kosong disembunyikan supaya tidak menambah jarak; di editor ia tempat meletakkan komponen. */}
      {body ? body({ className: cn(stackVars, "flex flex-col gap-4", !editing && "empty:hidden"), minEmptyHeight: 48 }) : null}
    </div>
  )
}

export function AccordionBlock({ variant, indicator, multiple, open, items, puck }: Omit<BlockProps<AccordionProps>, "items"> & { items: WithBody<AccordionItemData>[] }) {
  const style = accordionStyle[variant] ?? accordionStyle.plain
  const opened = open > 0 ? [String(open - 1)] : []
  const portal = useOverlayPortal(puck)
  const custom = indicator === "plus" || indicator === "none"
  return (
    <div className={elementFrame}>
      {/* key: mengganti isian "Butir yang terbuka" membuka butir itu lagi, juga di editor. */}
      <Accordion key={`${open}-${multiple}`} defaultValue={opened} multiple={multiple === "yes"} className={style.root}>
        {items.map((item, index) => (
          <AccordionItem key={index} value={String(index)} className={style.item}>
            <AccordionTrigger
              ref={portal}
              // Penanda bawaan (panah) disembunyikan bila memakai plus/minus atau tanpa penanda.
              className={cn("group/accordion-trigger items-center", custom && "**:data-[slot=accordion-trigger-icon]:hidden")}
            >
              <span className="flex flex-1 items-center gap-3">
                {item.icon ? (
                  <IconTile size="sm" aria-hidden="true">
                    <PageIcon name={item.icon} />
                  </IconTile>
                ) : null}
                {item.title}
              </span>
              {indicator === "plus" ? (
                <span aria-hidden="true" className="relative size-4 shrink-0 text-muted-foreground">
                  <PlusIcon className="absolute inset-0 size-4 transition-transform duration-200 group-aria-expanded/accordion-trigger:rotate-45" />
                </span>
              ) : null}
            </AccordionTrigger>
            {/* Jarak antarparagraf diatur ItemBody, bukan AccordionContent. */}
            <AccordionContent className="[&_p:not(:last-child)]:mb-0">
              <ItemBody content={item.content} body={item.body} editing={puck.isEditing} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

export type TabItemData = { label: string; icon: string; content: string; body: Slot }

export type TabsProps = {
  variant: "pill" | "line" | "outline" | "vertical"
  align: "left" | "center" | "stretch"
  /** Tab yang terbuka saat halaman dibuka (dan yang dibuka di editor), mulai dari 1. */
  active: number
  items: TabItemData[]
}

const tabListAlign = { left: "", center: "mx-auto", stretch: "w-full" }

export function TabsBlock({ variant, align, active, items, puck }: Omit<BlockProps<TabsProps>, "items"> & { items: WithBody<TabItemData>[] }) {
  const portal = useOverlayPortal(puck)
  if (items.length === 0) return null
  const current = String(Math.min(Math.max((active || 1) - 1, 0), items.length - 1))
  const vertical = variant === "vertical"
  return (
    <div className={elementFrame}>
      {/* Tab bisa diklik langsung di editor (overlay portal), untuk menyusun isi setiap tab. key: mengganti
          isian "Tab yang terbuka" membuka tab itu lagi. */}
      <Tabs key={current} defaultValue={current} orientation={vertical ? "vertical" : "horizontal"} className={cn(vertical && "gap-6 max-md:flex-col")}>
        <TabsList
          ref={portal}
          variant={variant === "line" ? "line" : "default"}
          className={cn(
            variant === "outline" && "h-auto gap-2 bg-transparent p-0",
            vertical ? "max-md:w-full max-md:flex-row max-md:overflow-x-auto md:w-56" : tabListAlign[align],
            !vertical && align === "stretch" && "w-full"
          )}
        >
          {items.map((item, index) => (
            <TabsTrigger
              key={index}
              value={String(index)}
              className={cn(
                variant === "outline" && "h-9 rounded-full border-border px-4 data-active:border-primary data-active:bg-primary data-active:text-primary-foreground dark:data-active:bg-primary",
                vertical && "md:h-9 md:justify-start md:px-3",
                !vertical && align !== "stretch" && "flex-none px-3"
              )}
            >
              {item.icon ? <PageIcon name={item.icon} /> : null}
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {items.map((item, index) => (
          <TabsContent key={index} value={String(index)} className="pt-3 text-base">
            <ItemBody content={item.content} body={item.body} editing={puck.isEditing} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

export type QuoteProps = { quote: string; name: string; role: string }

export function QuoteBlock({ quote, name, role }: BlockProps<QuoteProps>) {
  return (
    <figure className={cn(elementFrame, "flex flex-col gap-3")}>
      <blockquote className="border-l-2 pl-6 text-lg text-pretty italic">{quote}</blockquote>
      {name ? (
        <figcaption className="pl-6 text-sm">
          <span className="font-semibold">{name}</span>
          {role ? <span className="text-muted-foreground"> · {role}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  )
}

export type ProfileProps = { image: string | null; name: string; role: string }

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
}

export function ProfileBlock({ image, name, role }: BlockProps<ProfileProps>) {
  return (
    <div className={cn(elementFrame, "flex items-center gap-3")}>
      <Avatar size="lg">
        {image ? <AvatarImage src={image} alt="" /> : null}
        <AvatarFallback>{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{name}</span>
        {role ? <span className="truncate text-sm text-muted-foreground">{role}</span> : null}
      </div>
    </div>
  )
}

export type StatProps = TextStyle &
  StatValue & {
    /** Data lama: angka sebagai teks ("5.000+"). Isian baru memakai number, prefix, dan suffix. */
    value?: string
    label: string
    align: Align
    format: NumberFormat
    decimals: number
    count: "yes" | "no"
  }

export function StatBlock({ label, align, count, format, decimals, font_size, color, ...rest }: BlockProps<StatProps>) {
  const stat = statOf(rest)
  return (
    <div className={cn(elementFrame, "@container flex flex-col gap-1", textAlign[align])}>
      <StatNumber
        number={stat.number}
        prefix={stat.prefix}
        suffix={stat.suffix}
        format={format ?? "plain"}
        decimals={decimals ?? stat.decimals ?? 0}
        animate={count === "yes"}
        className="text-[min(2.25rem,15cqw)] font-semibold tracking-tight whitespace-nowrap tabular-nums"
        style={textStyle({ font_size: font_size > 0 ? font_size : 0, color }, true, "15cqw")}
      />
      {label ? <span className="text-sm text-muted-foreground">{label}</span> : null}
    </div>
  )
}

export type FeatureProps = { icon: string; title: string; description: string; style: "default" | "outline" | "muted" }

export function FeatureBlock({ icon, title, description, style }: BlockProps<FeatureProps>) {
  return (
    <div className={elementFrame}>
      <Item variant={style} className="items-start">
        <ItemMedia>
          <IconTile size="sm" aria-hidden="true">
            <SiteIcon name={icon} />
          </IconTile>
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="line-clamp-none">{title}</ItemTitle>
          {description ? <ItemDescription className="line-clamp-none text-pretty">{description}</ItemDescription> : null}
        </ItemContent>
      </Item>
    </div>
  )
}
