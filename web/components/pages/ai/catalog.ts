import type { Field, Fields } from "@puckeditor/core"

import type { Appearance } from "../appearance"
import { drawerTabs, pageConfig } from "../config"

// Katalog blok untuk AI: dibaca langsung dari konfigurasi editor, jadi selalu
// sama dengan blok yang benar-benar ada. Dipakai untuk menyusun prompt
// (prompt.ts) dan memeriksa jawaban AI (import.ts).

export type Choice = { value: string; label: string }

export type FieldSpec =
  | { kind: "text"; label: string; long?: boolean }
  | { kind: "html"; label: string }
  | { kind: "number"; label: string; min?: number; max?: number }
  | { kind: "enum"; label: string; options: Choice[] }
  | { kind: "image"; label: string }
  | { kind: "icon"; label: string }
  | { kind: "color"; label: string }
  | { kind: "date"; label: string }
  | { kind: "list"; label: string; max?: number; item: Record<string, FieldSpec>; itemDefaults: Record<string, unknown> }
  /** Wadah komponen (slot Puck): komponen lain di dalamnya, hanya jenis yang boleh. */
  | { kind: "slot"; label: string; allow: string[] }

export type BlockSpec = {
  type: string
  label: string
  group: string
  fields: Record<string, FieldSpec>
  defaults: Record<string, unknown>
}

/**
 * Komponen penyusun untuk "Desain bebas": wadah dan elemen yang aman disusun
 * AI menjadi bagian sendiri. Komponen yang butuh penjelasan panjang atau
 * jarang cocok (kode, dialog, daftar isi, orbit) tidak ditawarkan.
 */
export const designTypes = [
  "Section",
  "Columns",
  "Grid",
  "Row",
  "Card",
  "Spacer",
  "Heading",
  "Paragraph",
  "Button",
  "Badge",
  "Image",
  "Icon",
  "List",
  "Divider",
  "Alert",
  "Accordion",
  "Tabs",
  "Quote",
  "Profile",
  "Stat",
  "Feature",
  "Video",
  "AvatarStack",
  "TextMarquee",
  "Carousel",
  "Table",
  "Progress",
  "Rating",
  "Timeline",
  "IconStack",
]

function specOf(field: Field): FieldSpec | null {
  const label = field.label ?? ""
  switch (field.type) {
    case "text":
      return { kind: "text", label }
    case "textarea":
      return { kind: "text", label, long: true }
    case "richtext":
      return { kind: "html", label }
    case "number":
      return { kind: "number", label, min: field.min, max: field.max }
    case "radio":
    case "select":
      return { kind: "enum", label, options: field.options.map((option) => ({ value: String(option.value), label: option.label })) }
    case "array":
      return {
        kind: "list",
        label,
        max: field.max,
        item: specsOf(field.arrayFields as Fields),
        itemDefaults: (field.defaultItemProps ?? {}) as Record<string, unknown>,
      }
    case "slot": {
      const allow = field.allow ?? designTypes
      return { kind: "slot", label, allow: allow.filter((type) => designTypes.includes(type) && !(field.disallow ?? []).includes(type)) }
    }
    case "custom": {
      // Isian khusus menandai jenisnya sendiri (fields.tsx, field-kit.tsx).
      const ai = field.metadata?.ai as Omit<FieldSpec, "label"> | undefined
      return ai ? ({ ...ai, label } as FieldSpec) : null
    }
    default:
      return null
  }
}

function specsOf(fields: Fields): Record<string, FieldSpec> {
  const specs: Record<string, FieldSpec> = {}
  for (const [key, field] of Object.entries(fields)) {
    const spec = specOf(field as Field)
    if (spec) specs[key] = spec
  }
  return specs
}

/** Blok siap pakai (tab Blok di editor), urut menurut kelompoknya. */
export function blockCatalog(): BlockSpec[] {
  const categories = pageConfig.categories as Record<string, { title?: string; components?: string[] }>
  const components = pageConfig.components as Record<string, { label?: string; fields?: Fields; defaultProps?: Record<string, unknown> }>
  return drawerTabs.blocks.flatMap((category) => {
    const group = categories[category]
    return (group?.components ?? []).map((type) => {
      const component = components[type]
      return {
        type,
        label: component?.label ?? type,
        group: group?.title ?? category,
        fields: specsOf(component?.fields ?? {}),
        defaults: component?.defaultProps ?? {},
      }
    })
  })
}

/** Komponen penyusun beserta isiannya, untuk mode "Desain bebas". */
export function componentCatalog(): BlockSpec[] {
  const categories = pageConfig.categories as Record<string, { title?: string; components?: string[] }>
  const components = pageConfig.components as Record<string, { label?: string; fields?: Fields; defaultProps?: Record<string, unknown> }>
  const groupOf = (type: string) => Object.values(categories).find((category) => category.components?.includes(type))?.title ?? "Komponen"
  return designTypes.map((type) => ({
    type,
    label: components[type]?.label ?? type,
    group: groupOf(type),
    fields: specsOf(components[type]?.fields ?? {}),
    defaults: components[type]?.defaultProps ?? {},
  }))
}

// --- Tampilan bagian ---------------------------------------------------------------------------

/** Bagian dari Tampilan bagian yang boleh diatur AI: latar, warna, pola, dan animasi muncul. */
export const appearanceSpec: Record<string, FieldSpec> = {
  background: {
    kind: "enum",
    label: "Jenis latar",
    options: [
      { value: "none", label: "Polos" },
      { value: "muted", label: "Abu-abu lembut" },
      { value: "card", label: "Kartu" },
      { value: "primary", label: "Warna utama tema" },
      { value: "inverse", label: "Gelap" },
      { value: "color", label: "Warna pilihan (isi color)" },
      { value: "gradient", label: "Gradien (isi color dan color2)" },
    ] satisfies { value: Appearance["background"]; label: string }[],
  },
  color: { kind: "color", label: "Warna latar, atau warna awal gradien" },
  color2: { kind: "color", label: "Warna akhir gradien" },
  direction: {
    kind: "enum",
    label: "Arah gradien",
    options: [
      { value: "diagonal", label: "Miring" },
      { value: "down", label: "Atas ke bawah" },
      { value: "right", label: "Kiri ke kanan" },
      { value: "radial", label: "Memancar dari atas" },
    ] satisfies { value: Appearance["direction"]; label: string }[],
  },
  pattern: {
    kind: "enum",
    label: "Pola latar",
    options: [
      { value: "none", label: "Tanpa pola" },
      { value: "grid", label: "Kisi" },
      { value: "dots", label: "Titik-titik" },
      { value: "stripes", label: "Garis miring" },
      { value: "glow", label: "Cahaya" },
      { value: "aurora", label: "Aurora (bergerak)" },
      { value: "retro", label: "Retro grid (bergerak)" },
      { value: "ripple", label: "Riak (bergerak)" },
      { value: "meteors", label: "Meteor (bergerak)" },
      { value: "rays", label: "Sinar (bergerak)" },
      { value: "flicker", label: "Kisi berkedip (bergerak)" },
    ] satisfies { value: Appearance["pattern"]; label: string }[],
  },
  reveal: {
    kind: "enum",
    label: "Animasi muncul",
    options: [
      { value: "none", label: "Tanpa" },
      { value: "fade", label: "Memudar" },
      { value: "up", label: "Naik" },
      { value: "zoom", label: "Membesar" },
      { value: "blur", label: "Dari buram" },
    ] satisfies { value: Appearance["reveal"]; label: string }[],
  },
}
