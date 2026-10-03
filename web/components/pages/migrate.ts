import type { Data } from "@puckeditor/core"

import { pageConfig } from "./config"
import { callToActionFrom } from "./library/contact"
import { heroFrom } from "./library/hero"
import { logosFrom, testimonialsFrom } from "./library/proof"

// Data halaman lama dibaca dengan blok yang sekarang: blok kembar yang sudah
// digabung diganti namanya, dan isian yang belum ada di data lama terisi
// nilai bawaan blok. Dijalankan saat data masuk ke editor dan ke halaman
// publik; hasilnya sama bila dijalankan berulang.

type Item = { type: string; props: Record<string, unknown> }

/** Nama blok lama → nama sekarang dan pengubah isiannya. */
const merged: Record<string, { type: string; props: (type: string, props: Record<string, unknown>) => Record<string, unknown> }> = {
  Hero: { type: "Hero", props: heroFrom },
  HeroSpotlight: { type: "Hero", props: heroFrom },
  CallToAction: { type: "CallToAction", props: callToActionFrom },
  CtaSpotlight: { type: "CallToAction", props: callToActionFrom },
  Testimonials: { type: "Testimonials", props: testimonialsFrom },
  TestimonialWall: { type: "Testimonials", props: testimonialsFrom },
  Logos: { type: "Logos", props: logosFrom },
}

function isItem(value: unknown): value is Item {
  return typeof value === "object" && value !== null && typeof (value as Item).type === "string" && typeof (value as Item).props === "object"
}

function walk(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(walk)
  if (isItem(value)) return migrateItem(value)
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, walk(inner)]))
  }
  return value
}

function migrateItem(item: Item): Item {
  const rule = merged[item.type]
  const type = rule?.type ?? item.type
  const props = rule ? rule.props(item.type, item.props) : item.props
  const defaults = (pageConfig.components as Record<string, { defaultProps?: Record<string, unknown> }>)[type]?.defaultProps ?? {}
  const walked = Object.fromEntries(Object.entries(props).map(([key, inner]) => [key, walk(inner)]))
  return { type, props: { ...defaults, ...walked } }
}

export function migrateContent(data: Data): Data {
  return {
    ...data,
    root: walk(data.root) as Data["root"],
    content: (data.content ?? []).map((item) => migrateItem(item as Item)) as Data["content"],
    zones: walk(data.zones ?? {}) as Data["zones"],
  }
}
