"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import type { ComponentConfig, CustomField } from "@puckeditor/core"
import { CheckIcon, CopyIcon, MinusIcon, TicketPercentIcon } from "lucide-react"
import { cn } from "cn"

import { Badge } from "@/components/reui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button, buttonVariants } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import { ColorScope } from "../appearance"
import { BlockImage, hasText, Hint, orHint, pageButton, resolveLink, Section, shownItems, textOf, useOverlayPortal, type BlockProps, type InlineText } from "../blocks"
import { itemField } from "../media-picker"
import { EffectFrame, type CardEffect } from "../effects"
import { cardEffectOptions, imageField, inline, introFields, layoutField, linkField, showFields, sk, when, yesNoField } from "../fields"
import { Buttons, cardColumns, lines, SectionIntro } from "./kit"

// Harga dan penawaran: daftar harga, paket harga, tanya jawab, promo.
//
// Contoh bawaan di sini sengaja tanpa harga, potongan, kode promo, tanggal,
// lama pengerjaan, atau cara bayar: semua itu fakta usaha yang dibaca
// pengunjung sebagai benar bila terbit apa adanya, dan AI penyusun halaman
// mengisi isian yang dilewatinya dari contoh ini. Isian yang kosong diberi
// petunjuk di editor dan tidak tampil bagi pengunjung.

const { t, s, b, i, c, a, p, w, intro, text } = sk

type Puck = BlockProps<unknown>["puck"]


// --- Daftar harga ----------------------------------------------------------------------------

/** Nama dan penjelasan bisa diketik langsung di kanvas; harga dan label kecilnya tidak. */
type PriceItem = { name: InlineText; description: InlineText; price: string; image: string | null; badge: string }

export type PriceListProps = {
  eyebrow: InlineText
  title: InlineText
  subtitle: InlineText
  variant: "list" | "cards" | "compact"
  tabs: "yes" | "no"
  categories: { name: string; items: PriceItem[] }[]
  note: string
}

/** Butir yang tampil bagi pengunjung: yang bernama. Harga tanpa nama tidak berarti apa-apa. */
const priceFilled = (item: PriceItem) => hasText(item.name)

const nameHint = "Nama produk atau layanan"
const noteHint = "Penjelasan singkat (boleh kosong)"

function PriceRow({ item, puck, photo, field }: { item: PriceItem; puck: Puck; photo: boolean; field?: string }) {
  const price = orHint(item.price, "Harga", puck)
  const note = orHint(item.description, noteHint, puck)
  return (
    <li className="flex gap-4">
      {photo && item.image ? <BlockImage src={item.image} alt="" className="size-16 shrink-0 rounded-lg" puck={puck} field={field} /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold">{orHint(item.name, nameHint, puck)}</span>
          {item.badge ? (
            <Badge variant="secondary" radius="full">
              {item.badge}
            </Badge>
          ) : null}
          {price ? (
            <>
              {/* Garis titik-titik antara nama dan harga; tanpa harga tidak ada yang ditunjuknya. */}
              <span aria-hidden="true" className="mx-1 min-w-4 flex-1 translate-y-[-0.25em] border-b border-dotted border-muted-foreground/40" />
              <span className="font-semibold whitespace-nowrap tabular-nums">{price}</span>
            </>
          ) : null}
        </div>
        {note ? <p className="text-sm text-pretty text-muted-foreground">{note}</p> : null}
      </div>
    </li>
  )
}

function PriceItems({
  items,
  variant,
  puck,
  list,
}: {
  items: PriceItem[]
  variant: PriceListProps["variant"]
  puck: Puck
  /** Jalur daftar ini di props blok ("categories.0.items"), supaya fotonya bisa diganti dari kanvas. */
  list?: string
}) {
  const field = (item: PriceItem) => (list ? itemField(list, items, item) : undefined)
  const shown = shownItems(items, priceFilled, puck)
  if (variant === "cards") {
    return (
      <ul className={cn("grid gap-4", cardColumns(shown.length))}>
        {shown.map((item, index) => {
          const price = orHint(item.price, "Harga", puck)
          const note = orHint(item.description, noteHint, puck)
          return (
            <li key={index} className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs">
              {item.image || puck.isEditing ? (
                <BlockImage src={item.image} alt="" className="aspect-4/3 w-full rounded-none border-0 border-b" puck={puck} field={field(item)} />
              ) : null}
              <div className="flex flex-1 flex-col gap-2 p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-semibold">{orHint(item.name, nameHint, puck)}</span>
                  {item.badge ? (
                    <Badge variant="secondary" radius="full">
                      {item.badge}
                    </Badge>
                  ) : null}
                </div>
                {note ? <p className="text-sm text-pretty text-muted-foreground">{note}</p> : null}
                {price ? <span className="mt-auto pt-2 text-lg font-semibold tabular-nums">{price}</span> : null}
              </div>
            </li>
          )
        })}
      </ul>
    )
  }
  if (variant === "compact") {
    return (
      <ul className="divide-y rounded-xl border bg-card">
        {shown.map((item, index) => {
          const price = orHint(item.price, "Harga", puck)
          const note = orHint(item.description, noteHint, puck)
          return (
            <li key={index} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{orHint(item.name, nameHint, puck)}</span>
                {note ? <span className="truncate text-sm text-muted-foreground">{note}</span> : null}
              </span>
              {price ? <span className="font-semibold whitespace-nowrap tabular-nums">{price}</span> : null}
            </li>
          )
        })}
      </ul>
    )
  }
  return (
    <ul className={cn("grid gap-x-12 gap-y-6", shown.length > 1 ? "md:grid-cols-2" : "mx-auto w-full max-w-xl")}>
      {shown.map((item, index) => (
        <PriceRow key={index} item={item} puck={puck} photo field={field(item)} />
      ))}
    </ul>
  )
}

export function PriceListBlock({ eyebrow, title, subtitle, variant, tabs, categories, note, puck }: BlockProps<PriceListProps>) {
  const portal = useOverlayPortal(puck)
  const groups = shownItems(categories, (category) => category.items.some(priceFilled), puck)
  // Tanpa butir yang terisi, bagi pengunjung hanya tersisa judul: tidak dirender.
  if (groups.length === 0 && !puck.isEditing) return null
  // Tab tanpa nama tidak bisa dipilih pengunjung: kategori tanpa nama membuat daftarnya bertumpuk.
  const tabbed = tabs === "yes" && groups.length > 1 && (puck.isEditing || groups.every((group) => group.name.trim()))
  return (
    <Section className="flex flex-col gap-10">
      <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
      {tabbed ? (
        // Kategori bisa diklik langsung di editor (overlay portal).
        <Tabs defaultValue="0" className="gap-8">
          <TabsList ref={portal} className="mx-auto h-auto flex-wrap justify-center">
            {groups.map((group, index) => (
              <TabsTrigger key={index} value={String(index)} className="flex-none px-4">
                {orHint(group.name, "Nama kategori", puck)}
              </TabsTrigger>
            ))}
          </TabsList>
          {groups.map((group, index) => (
            <TabsContent key={index} value={String(index)}>
              <PriceItems items={group.items} variant={variant} puck={puck} list={itemField("categories", categories, group, "items")} />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className="flex flex-col gap-10">
          {groups.map((group, index) => {
            const heading = groups.length > 1 ? orHint(group.name, "Nama kategori", puck) : null
            return (
              <div key={index} className="flex flex-col gap-5">
                {heading ? <h3 className="text-xl font-semibold tracking-tight">{heading}</h3> : null}
                <PriceItems items={group.items} variant={variant} puck={puck} list={itemField("categories", categories, group, "items")} />
              </div>
            )
          })}
        </div>
      )}
      {note ? <p className="text-center text-sm text-muted-foreground">{note}</p> : null}
    </Section>
  )
}

const priceItemFields = {
  name: inline({ type: "text", label: "Nama produk atau layanan" }),
  price: { type: "text", label: "Harga", placeholder: "Tulis dengan Rp; kosongkan bila tidak ditampilkan" },
  description: inline({ type: "textarea", label: "Penjelasan singkat (boleh kosong)" }),
  image: imageField("Foto (untuk susunan kartu dan daftar)"),
  badge: { type: "text", label: "Label kecil di samping nama (boleh kosong)", placeholder: "Misalnya: Baru" },
} as const

const emptyItem = (): PriceItem => ({ name: "", price: "", description: "", image: null, badge: "" })

export const priceListConfig: ComponentConfig<PriceListProps> = {
  label: "Daftar harga",
  fields: {
    variant: layoutField<PriceListProps["variant"]>("Susunan", [
      {
        value: "list",
        label: "Daftar dua kolom",
        sketch: [
          ...intro(30, 3),
          s(6, 13, 12),
          s(19, 13.6, 7),
          s(27, 13, 3),
          s(33, 13, 12),
          s(46, 13.6, 7),
          s(54, 13, 3),
          s(6, 19, 12),
          s(27, 19, 3),
          s(33, 19, 12),
          s(54, 19, 3),
          s(6, 25, 12),
          s(27, 25, 3),
          s(33, 25, 12),
          s(54, 25, 3),
        ],
      },
      {
        value: "cards",
        label: "Kartu berfoto",
        sketch: [
          ...intro(30, 3),
          c(5, 12, 15, 21),
          i(5, 12, 15, 9),
          s(7, 24, 9),
          t(7, 28, 6),
          c(22.5, 12, 15, 21),
          i(22.5, 12, 15, 9),
          s(24.5, 24, 9),
          t(24.5, 28, 6),
          c(40, 12, 15, 21),
          i(40, 12, 15, 9),
          s(42, 24, 9),
          t(42, 28, 6),
        ],
      },
      {
        value: "compact",
        label: "Ringkas satu kolom",
        sketch: [...intro(30, 3), c(10, 12, 40, 21), s(13, 15, 16), s(42, 15, 5), s(13, 21, 18), s(42, 21, 5), s(13, 27, 14), s(42, 27, 5)],
      },
    ]),
    ...introFields,
    tabs: yesNoField("Kategori sebagai tab"),
    categories: {
      type: "array",
      label: "Kategori",
      max: 12,
      getItemSummary: (category) => `${category.name || "Tanpa nama"} · ${category.items?.length ?? 0} item`,
      defaultItemProps: { name: "", items: [emptyItem()] },
      arrayFields: {
        name: { type: "text", label: "Nama kategori" },
        items: {
          type: "array",
          label: "Item",
          max: 40,
          getItemSummary: (entry) => [textOf(entry.name), entry.price].filter(Boolean).join(" · ") || "Item",
          defaultItemProps: emptyItem(),
          arrayFields: priceItemFields,
        },
      },
    },
    note: { type: "text", label: "Catatan di bawah daftar", placeholder: "Catatan untuk semua harga di atas" },
  },
  defaultProps: {
    eyebrow: "Harga",
    title: "Daftar harga",
    subtitle: "Pilih yang paling sesuai dengan kebutuhan Anda.",
    variant: "list",
    tabs: "yes",
    categories: [
      { name: "Utama", items: [emptyItem(), emptyItem(), emptyItem()] },
      { name: "Tambahan", items: [emptyItem(), emptyItem(), emptyItem()] },
    ],
    note: "",
  },
  render: (props) => <PriceListBlock {...props} />,
}

// --- Harga (paket) ---------------------------------------------------------------------------

/** Nama paket dan untuk siapa bisa diketik langsung di kanvas; harga, satuan, dan isinya tidak. */
type Plan = {
  name: InlineText
  price: string
  price_yearly?: string
  period: string
  period_yearly?: string
  description: InlineText
  features: string
  button_label: string
  button_link: string
  highlighted: "yes" | "no"
  badge: string
}

export type PricingProps = {
  eyebrow: InlineText
  title: InlineText
  subtitle: InlineText
  variant: "cards" | "toggle" | "table" | "single"
  monthly_label: string
  yearly_label: string
  plans: Plan[]
  note: string
  featured_effect: CardEffect
}

/** Paket yang tampil bagi pengunjung: yang berharga atau berisi. Nama paket contoh saja tidak cukup. */
const planFilled = (plan: Plan) => Boolean(plan.price.trim() || lines(plan.features).length > 0)

/** Kisi paket menurut jumlahnya: empat paket menjadi 2×2 lalu sebaris, bukan tiga ditambah satu. */
function planColumns(count: number): string {
  if (count <= 1) return "mx-auto w-full max-w-md"
  if (count === 2) return "mx-auto w-full max-w-3xl md:grid-cols-2"
  if (count === 4) return "md:grid-cols-2 lg:grid-cols-4"
  return "md:grid-cols-3"
}

function PlanButton({ plan, featured, puck, className }: { plan: Plan; featured: boolean; puck: Puck; className?: string }) {
  const target = resolveLink(plan.button_link, puck)
  if (!plan.button_label || !(target || puck.isEditing)) return null
  return (
    <a href={puck.isEditing ? undefined : target} className={cn(buttonVariants({ variant: featured ? "default" : "outline" }), pageButton, "w-full", className)}>
      {plan.button_label}
    </a>
  )
}

/** Harga dan satuannya; di editor harga yang kosong diberi petunjuk. */
function PlanPrice({ price, period, puck, large = false }: { price: string; period: string; puck: Puck; large?: boolean }) {
  const amount = orHint(price, "Harga", puck)
  if (!amount) return null
  return (
    <p className="flex flex-wrap items-baseline gap-x-1">
      {/* Harga panjang di kartu sempit (empat sebaris) dipatahkan, tidak meluber. */}
      <span className={cn("min-w-0 font-semibold tracking-tight wrap-break-word tabular-nums", large ? "text-5xl" : "text-4xl")}>{amount}</span>
      {period ? <span className={cn("text-muted-foreground", !large && "text-sm")}>{period}</span> : null}
    </p>
  )
}

function PlanFeatures({ plan, puck, className }: { plan: Plan; puck: Puck; className: string }) {
  const features = lines(plan.features)
  if (features.length === 0) {
    if (!puck.isEditing) return null
    return (
      <ul className={className}>
        <li>
          <Hint>Isi paket, satu per baris</Hint>
        </li>
      </ul>
    )
  }
  return (
    <ul className={className}>
      {features.map((feature, position) => (
        <li key={position} className="flex items-start gap-2.5">
          <CheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
          {feature}
        </li>
      ))}
    </ul>
  )
}

function PlanCards({ plans, yearly, effect, puck }: { plans: Plan[]; yearly: boolean; effect: CardEffect; puck: Puck }) {
  return (
    <ul className={cn("grid items-stretch gap-6", planColumns(plans.length))}>
      {plans.map((plan, index) => {
        const featured = plan.highlighted === "yes"
        const price = yearly ? plan.price_yearly || plan.price : plan.price
        const period = yearly ? plan.period_yearly || plan.period : plan.period
        const name = orHint(plan.name, "Nama paket", puck)
        const description = orHint(plan.description, "Untuk siapa paket ini", puck)
        return (
          <li key={index} className="flex">
            <EffectFrame effect={featured ? effect : "none"} className="flex flex-1 rounded-2xl">
              <div
                className={cn(
                  "relative flex flex-1 flex-col gap-6 rounded-2xl border bg-card p-6 shadow-xs",
                  featured && "border-(--page-accent) shadow-lg ring-1 ring-(--page-accent)"
                )}
              >
                {/* Tanpa label isian tidak ada kata bawaan: "paling laris" adalah klaim usaha. */}
                {featured && plan.badge.trim() ? (
                  <Badge radius="full" className="absolute -top-2.5 left-6">
                    {plan.badge}
                  </Badge>
                ) : null}
                <div className="flex flex-col gap-2">
                  {name ? <h3 className="font-semibold">{name}</h3> : null}
                  <PlanPrice price={price} period={period} puck={puck} />
                  {description ? <p className="text-sm text-pretty text-muted-foreground">{description}</p> : null}
                </div>
                <PlanFeatures plan={plan} puck={puck} className="flex flex-col gap-2.5 text-sm" />
                <PlanButton plan={plan} featured={featured} puck={puck} className="mt-auto" />
              </div>
            </EffectFrame>
          </li>
        )
      })}
    </ul>
  )
}

/** Tabel perbandingan: baris = gabungan isi semua paket, kolom = paket. */
function PlanTable({ plans, puck }: { plans: Plan[]; puck: Puck }) {
  const rows = [...new Set(plans.flatMap((plan) => lines(plan.features)))]
  const template = { gridTemplateColumns: `minmax(9rem, 1.6fr) repeat(${plans.length}, minmax(9rem, 1fr))` }
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-xs">
      <div role="table" aria-label="Perbandingan paket" className="min-w-fit text-sm">
        <div role="row" className="grid border-b" style={template}>
          <span role="columnheader" className="p-4" />
          {plans.map((plan, index) => (
            <div key={index} role="columnheader" className={cn("flex flex-col gap-1 p-4", plan.highlighted === "yes" && "bg-muted/60")}>
              <span className="font-semibold">{orHint(plan.name, "Nama paket", puck)}</span>
              <span className="text-xl font-semibold tracking-tight wrap-break-word tabular-nums sm:text-2xl">{orHint(plan.price, "Harga", puck)}</span>
              {plan.period ? <span className="text-xs text-muted-foreground">{plan.period}</span> : null}
            </div>
          ))}
        </div>
        {rows.length === 0 && puck.isEditing ? (
          <div role="row" className="grid border-b" style={template}>
            <span role="rowheader" className="p-4">
              <Hint>Isi paket, satu per baris: setiap baris menjadi baris tabel</Hint>
            </span>
            {plans.map((plan, index) => (
              <span key={index} role="cell" className={cn("p-4", plan.highlighted === "yes" && "bg-muted/60")} />
            ))}
          </div>
        ) : null}
        {rows.map((row) => (
          <div key={row} role="row" className="grid border-b last:border-b-0" style={template}>
            <span role="rowheader" className="p-4 text-muted-foreground">
              {row}
            </span>
            {plans.map((plan, index) => (
              <span key={index} role="cell" className={cn("flex items-center p-4", plan.highlighted === "yes" && "bg-muted/60")}>
                {lines(plan.features).includes(row) ? (
                  <CheckIcon aria-label="Termasuk" className="size-4 text-success" />
                ) : (
                  <MinusIcon aria-label="Tidak termasuk" className="size-4 text-muted-foreground/50" />
                )}
              </span>
            ))}
          </div>
        ))}
        <div role="row" className="grid" style={template}>
          <span role="cell" className="p-4" />
          {plans.map((plan, index) => (
            <span key={index} role="cell" className={cn("p-4", plan.highlighted === "yes" && "bg-muted/60")}>
              <PlanButton plan={plan} featured={plan.highlighted === "yes"} puck={puck} />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function SinglePlan({ plan, puck }: { plan: Plan; puck: Puck }) {
  // Tanpa isi paket, sisi kanannya kosong: kartunya menjadi satu kolom.
  const listed = lines(plan.features).length > 0 || puck.isEditing
  const name = orHint(plan.name, "Nama paket", puck)
  const description = orHint(plan.description, "Untuk siapa paket ini", puck)
  return (
    <div
      className={cn(
        "mx-auto grid w-full overflow-hidden rounded-3xl border bg-card shadow-lg",
        listed ? "max-w-4xl md:grid-cols-[1fr_1.2fr]" : "max-w-md"
      )}
    >
      <div className={cn("flex flex-col gap-4 bg-muted/50 p-8", listed && "border-b md:border-r md:border-b-0")}>
        {plan.badge ? (
          <Badge radius="full" className="self-start">
            {plan.badge}
          </Badge>
        ) : null}
        {name ? <h3 className="text-xl font-semibold">{name}</h3> : null}
        {description ? <p className="text-sm text-pretty text-muted-foreground">{description}</p> : null}
        <PlanPrice price={plan.price} period={plan.period} puck={puck} large />
        <PlanButton plan={plan} featured puck={puck} className="mt-auto" />
      </div>
      {listed ? (
        <div className="flex flex-col gap-4 p-8">
          <span className="text-sm font-medium">Yang Anda dapat</span>
          <PlanFeatures plan={plan} puck={puck} className="grid gap-3 text-sm sm:grid-cols-2" />
        </div>
      ) : null}
    </div>
  )
}

export function PricingBlock(props: BlockProps<PricingProps>) {
  const { eyebrow, title, subtitle, variant, plans, note, featured_effect, puck } = props
  const [yearly, setYearly] = useState(false)
  const portal = useOverlayPortal(puck)
  const shown = shownItems(plans, planFilled, puck)
  // Tanpa paket yang berharga atau berisi, bagi pengunjung hanya tersisa judul: tidak dirender.
  if (shown.length === 0 && !puck.isEditing) return null
  // Pilihan tahunan tanpa satu pun harga tahunan tidak mengubah apa-apa bagi pengunjung.
  const toggle = variant === "toggle" && (puck.isEditing || shown.some((plan) => plan.price_yearly?.trim()))
  let body
  if (variant === "table") body = <PlanTable plans={shown} puck={puck} />
  else if (variant === "single") {
    const plan = shown.find((entry) => entry.highlighted === "yes") ?? shown[0]
    body = plan ? <SinglePlan plan={plan} puck={puck} /> : null
  } else {
    body = (
      <>
        {toggle ? (
          // Bisa diklik langsung di editor (overlay portal).
          <ToggleGroup
            value={[yearly ? "yearly" : "monthly"]}
            onValueChange={(next) => next[0] && setYearly(next[0] === "yearly")}
            className="mx-auto rounded-full bg-muted p-1"
            spacing={1}
          >
            <ToggleGroupItem ref={portal} value="monthly" className="h-8 rounded-full px-4 aria-pressed:bg-background aria-pressed:shadow-xs">
              {props.monthly_label || "Bulanan"}
            </ToggleGroupItem>
            <ToggleGroupItem ref={portal} value="yearly" className="h-8 rounded-full px-4 aria-pressed:bg-background aria-pressed:shadow-xs">
              {props.yearly_label || "Tahunan"}
            </ToggleGroupItem>
          </ToggleGroup>
        ) : null}
        <PlanCards plans={shown} yearly={toggle && yearly} effect={featured_effect} puck={puck} />
      </>
    )
  }
  return (
    <Section className="flex flex-col gap-10">
      <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
      {body}
      {note ? <p className="text-center text-sm text-muted-foreground">{note}</p> : null}
    </Section>
  )
}

/** Paket contoh: nama dan untuk siapa saja. Harga, satuan, dan isinya fakta usaha, jadi kosong. */
const plan = (name: string, description: string, highlighted: "yes" | "no" = "no"): Plan => ({
  name,
  price: "",
  price_yearly: "",
  period: "",
  period_yearly: "",
  description,
  features: "",
  button_label: "Pilih paket",
  button_link: "#kontak",
  highlighted,
  badge: "",
})

export const pricingConfig: ComponentConfig<PricingProps> = {
  label: "Harga",
  fields: {
    variant: layoutField<PricingProps["variant"]>("Susunan", [
      {
        value: "cards",
        label: "Kartu paket",
        sketch: [
          ...intro(30, 3),
          c(5, 12, 15, 21),
          t(7, 15, 7),
          b(7, 28, 11),
          c(22.5, 11, 15, 22),
          t(24.5, 14, 7),
          b(24.5, 28, 11),
          c(40, 12, 15, 21),
          t(42, 15, 7),
          b(42, 28, 11),
        ],
      },
      {
        value: "toggle",
        label: "Bulanan / tahunan",
        sketch: [
          ...intro(30, 2),
          a(22, 9, 16, 3),
          b(23, 9.3, 7.5),
          c(5, 14, 15, 19),
          t(7, 17, 7),
          c(22.5, 14, 15, 19),
          t(24.5, 17, 7),
          c(40, 14, 15, 19),
          t(42, 17, 7),
        ],
      },
      {
        value: "table",
        label: "Tabel perbandingan",
        sketch: [
          ...intro(30, 2),
          c(4, 10, 52, 23),
          t(22, 12, 6),
          t(33, 12, 6),
          t(44, 12, 6),
          s(6, 18, 12),
          s(6, 23, 12),
          s(6, 28, 12),
          a(24, 18, 2, 1.3),
          a(35, 18, 2, 1.3),
          a(46, 18, 2, 1.3),
          a(35, 23, 2, 1.3),
          a(46, 23, 2, 1.3),
          a(46, 28, 2, 1.3),
        ],
      },
      {
        value: "single",
        label: "Satu paket",
        sketch: [
          ...intro(30, 2),
          c(8, 10, 44, 23),
          a(8, 10, 18, 23),
          t(11, 14, 10),
          t(11, 19, 12),
          b(11, 27, 12),
          s(29, 15, 9),
          s(41, 15, 9),
          s(29, 20, 9),
          s(41, 20, 9),
          s(29, 25, 9),
        ],
      },
    ]),
    ...introFields,
    monthly_label: { type: "text", label: "Label pilihan harga bulanan" },
    yearly_label: { type: "text", label: "Label pilihan harga tahunan", placeholder: "Tahunan" },
    plans: {
      type: "array",
      label: "Paket",
      max: 5,
      getItemSummary: (entry) => textOf(entry.name) || "Paket tanpa nama",
      defaultItemProps: plan("", ""),
      arrayFields: {
        name: inline({ type: "text", label: "Nama paket" }),
        price: { type: "text", label: "Harga", placeholder: "Tulis dengan Rp; kosongkan bila tidak ditampilkan" },
        period: { type: "text", label: "Satuan harga (boleh kosong)", placeholder: "Misalnya: /sesi atau /orang" },
        price_yearly: { type: "text", label: "Harga tahunan (untuk susunan bulanan/tahunan)", placeholder: "Tulis dengan Rp" },
        period_yearly: { type: "text", label: "Satuan harga tahunan (boleh kosong)", placeholder: "Misalnya: /bulan, ditagih tahunan" },
        description: inline({ type: "textarea", label: "Untuk siapa paket ini" }),
        features: { type: "textarea", label: "Isi paket (satu per baris)" },
        button_label: { type: "text", label: "Teks tombol" },
        button_link: linkField,
        highlighted: yesNoField("Tonjolkan paket ini"),
        badge: { type: "text", label: "Label paket yang ditonjolkan (boleh kosong)", placeholder: "Misalnya: Pilihan utama" },
      },
    },
    note: { type: "text", label: "Catatan di bawah harga" },
    featured_effect: { type: "select", label: "Efek paket yang ditonjolkan", options: cardEffectOptions },
  },
  resolveFields: showFields<PricingProps>({
    monthly_label: when("variant", "toggle"),
    yearly_label: when("variant", "toggle"),
    featured_effect: when("variant", "cards", "toggle"),
  }),
  defaultProps: {
    eyebrow: "Harga",
    title: "Pilih paket yang pas",
    subtitle: "Bandingkan isi setiap paket, lalu pilih yang sesuai dengan kebutuhan Anda.",
    variant: "cards",
    monthly_label: "Bulanan",
    yearly_label: "Tahunan",
    plans: [
      plan("Dasar", "Untuk kebutuhan yang sederhana."),
      plan("Standar", "Untuk kebutuhan yang lebih banyak.", "yes"),
      plan("Lengkap", "Untuk kebutuhan yang lebih khusus."),
    ],
    note: "",
    featured_effect: "none",
  },
  render: (props) => <PricingBlock {...props} />,
}

// --- Tanya jawab -------------------------------------------------------------------------------

/** Jawaban bisa diketik langsung di kanvas; pertanyaan tidak, karena ia tombol pembuka jawabannya. */
type FaqItem = { question: string; answer: InlineText }

export type FaqProps = {
  eyebrow: InlineText
  title: InlineText
  subtitle: InlineText
  variant: "single" | "two" | "side" | "contact"
  items: FaqItem[]
  contact_title: string
  contact_text: string
  contact_label: string
  contact_link: string
}

/** Yang tampil bagi pengunjung: pertanyaan yang sudah dijawab. */
const faqFilled = (entry: FaqItem) => Boolean(entry.question.trim()) && hasText(entry.answer)

function FaqAccordion({ items, puck }: { items: FaqItem[]; puck: Puck }) {
  const portal = useOverlayPortal(puck)
  return (
    <Accordion className="rounded-xl border bg-card px-5">
      {items.map((entry, index) => (
        <AccordionItem key={index} value={String(index)}>
          <AccordionTrigger ref={portal} className="text-base">
            <span>
              {orHint(entry.question, "Tulis pertanyaannya", puck)}
              {/* Jawabannya tersembunyi sampai dibuka: tanda ini mengingatkan bahwa yang belum dijawab tidak terbit. */}
              {puck.isEditing && !hasText(entry.answer) ? <Hint className="ml-2 text-sm font-normal">belum dijawab</Hint> : null}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <p className="whitespace-pre-line text-muted-foreground">{orHint(entry.answer, "Tulis jawabannya", puck)}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

export function FaqBlock(props: BlockProps<FaqProps>) {
  const { eyebrow, title, subtitle, variant, items, puck } = props
  const shown = shownItems(items, faqFilled, puck)
  // Tanpa pertanyaan yang terjawab, bagi pengunjung hanya tersisa judul: tidak dirender.
  if (shown.length === 0 && !puck.isEditing) return null
  if (variant === "two") {
    return (
      <Section className="flex flex-col gap-12">
        <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
        <dl className={cn("grid gap-x-12 gap-y-8", shown.length > 1 ? "md:grid-cols-2" : "mx-auto w-full max-w-2xl")}>
          {shown.map((entry, index) => (
            <div key={index} className="flex flex-col gap-2">
              <dt className="font-semibold">{orHint(entry.question, "Tulis pertanyaannya", puck)}</dt>
              <dd className="whitespace-pre-line text-pretty text-muted-foreground">{orHint(entry.answer, "Tulis jawabannya", puck)}</dd>
            </div>
          ))}
        </dl>
      </Section>
    )
  }
  if (variant === "side") {
    return (
      <Section className="grid gap-10 md:grid-cols-[1fr_1.6fr] md:gap-16">
        <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} align="left" className="md:sticky md:top-24 md:self-start" />
        <FaqAccordion items={shown} puck={puck} />
      </Section>
    )
  }
  return (
    <Section className="flex max-w-3xl flex-col gap-10">
      <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <FaqAccordion items={shown} puck={puck} />
      {variant === "contact" ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-muted px-6 py-8 text-center">
          {props.contact_title ? <h3 className="text-lg font-semibold">{props.contact_title}</h3> : null}
          {props.contact_text ? <p className="max-w-md text-pretty text-muted-foreground">{props.contact_text}</p> : null}
          <Buttons primary={{ label: props.contact_label, link: props.contact_link }} align="center" puck={puck} className="pt-1" />
        </div>
      ) : null}
    </Section>
  )
}

export const faqConfig: ComponentConfig<FaqProps> = {
  label: "Tanya jawab",
  fields: {
    variant: layoutField<FaqProps["variant"]>("Susunan", [
      { value: "single", label: "Satu kolom", sketch: [...intro(30, 3), c(12, 12, 36, 21), s(15, 15.5, 22), s(15, 21.5, 18), s(15, 27.5, 20)] },
      {
        value: "two",
        label: "Dua kolom terbuka",
        sketch: [...intro(30, 3), t(6, 13, 18), s(6, 16.5, 20), t(34, 13, 18), s(34, 16.5, 20), t(6, 23, 16), s(6, 26.5, 20), t(34, 23, 16), s(34, 26.5, 20)],
      },
      { value: "side", label: "Judul di samping", sketch: [...text(4, 6, 16), c(25, 5, 31, 26), s(28, 9, 20), s(28, 16, 18), s(28, 23, 20)] },
      {
        value: "contact",
        label: "Dengan kotak kontak",
        sketch: [...intro(30, 2), c(12, 9, 36, 14), s(15, 12, 22), s(15, 18, 18), a(14, 25, 32, 9), b(25.5, 29)],
      },
    ]),
    ...introFields,
    items: {
      type: "array",
      label: "Pertanyaan",
      max: 40,
      getItemSummary: (entry) => entry.question || "Pertanyaan",
      defaultItemProps: { question: "", answer: "" },
      arrayFields: {
        question: { type: "text", label: "Pertanyaan" },
        answer: inline({ type: "textarea", label: "Jawaban (pertanyaan tanpa jawaban tidak tampil)" }),
      },
    },
    contact_title: { type: "text", label: "Judul kotak kontak" },
    contact_text: { type: "textarea", label: "Kalimat kotak kontak" },
    contact_label: { type: "text", label: "Teks tombol" },
    contact_link: linkField,
  },
  resolveFields: showFields<FaqProps>({
    contact_title: when("variant", "contact"),
    contact_text: when("variant", "contact"),
    contact_label: when("variant", "contact"),
    contact_link: when("variant", "contact"),
  }),
  defaultProps: {
    eyebrow: "",
    title: "Pertanyaan yang sering diajukan",
    subtitle: "",
    variant: "single",
    // Pertanyaan umum boleh jadi contoh; jawabannya fakta usaha, jadi kosong.
    items: [
      { question: "Bagaimana cara memesan?", answer: "" },
      { question: "Berapa lama prosesnya?", answer: "" },
      { question: "Pembayarannya bisa lewat apa saja?", answer: "" },
    ],
    contact_title: "Masih ada pertanyaan?",
    contact_text: "",
    contact_label: "Hubungi kami",
    contact_link: "#kontak",
  },
  render: (props) => <FaqBlock {...props} />,
}

// --- Promo -----------------------------------------------------------------------------------

export type PromoProps = {
  variant: "banner" | "card" | "split"
  badge: string
  /** Judul dan isi promo bisa diketik langsung di kanvas. */
  title: InlineText
  subtitle: InlineText
  code: string
  ends_at: string
  countdown: "yes" | "no"
  button_label: string
  button_link: string
  image: string | null
}

/** Akhir promo: penghujung hari `date` (YYYY-MM-DD, waktu setempat), atau NaN tanpa tanggal. */
function promoEnd(date: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return Number.NaN
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59).getTime()
}

/**
 * Waktu sekarang, diperbarui selama promo berjalan: tiap detik untuk hitung
 * mundur, tiap menit cukup untuk menyembunyikan promo begitu berakhir.
 */
function useNow(end: number, everySecond: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  // NaN (tanpa tanggal) tidak pernah berjalan.
  const running = now <= end
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setNow(Date.now()), everySecond ? 1000 : 60_000)
    return () => window.clearInterval(timer)
  }, [running, everySecond])
  return now
}

function Countdown({ left }: { left: number }) {
  const parts = [
    { value: Math.floor(left / 86_400_000), label: "hari" },
    { value: Math.floor(left / 3_600_000) % 24, label: "jam" },
    { value: Math.floor(left / 60_000) % 60, label: "menit" },
    { value: Math.floor(left / 1000) % 60, label: "detik" },
  ]
  return (
    <div role="timer" aria-label="Sisa waktu promo" className="flex gap-2">
      {parts.map((part) => (
        <span key={part.label} className="flex min-w-14 flex-col items-center rounded-lg border bg-background/70 px-2 py-1.5 text-foreground backdrop-blur">
          <span className="text-xl font-semibold tabular-nums">{String(part.value).padStart(2, "0")}</span>
          <span className="text-xs text-muted-foreground">{part.label}</span>
        </span>
      ))}
    </div>
  )
}

function PromoCode({ code, puck }: { code: string; puck: Puck }) {
  const [copied, setCopied] = useState(false)
  const text = useRef<HTMLSpanElement>(null)
  if (!code.trim()) {
    if (!puck.isEditing) return null
    return (
      <span className="inline-flex items-center gap-2 rounded-lg border border-dashed bg-background/70 px-3 py-1.5">
        <TicketPercentIcon aria-hidden="true" className="size-4 text-muted-foreground" />
        <Hint>Kode promo (boleh kosong)</Hint>
      </span>
    )
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Peramban menolak (izin, atau halaman tanpa https): kodenya ditandai
      // supaya bisa disalin sendiri, dan tombolnya tidak mengaku tersalin.
      if (text.current) window.getSelection()?.selectAllChildren(text.current)
    }
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-dashed bg-background/70 py-1 pr-1 pl-3 text-foreground">
      <TicketPercentIcon aria-hidden="true" className="size-4 text-muted-foreground" />
      <span ref={text} className="font-mono font-semibold tracking-wider">
        {code}
      </span>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={copied ? "Kode tersalin" : "Salin kode promo"} onClick={() => void copy()}>
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </span>
  )
}

export function PromoBlock(props: BlockProps<PromoProps>) {
  const { variant, badge, title, subtitle, code, ends_at, countdown, image, puck } = props
  const end = promoEnd(ends_at)
  const now = useNow(end, countdown === "yes")
  const ended = now > end
  // Promo yang sudah lewat tidak boleh tetap terbit seolah masih berlaku; promo
  // tanpa judul maupun isi hanya menyisakan label dan tombol.
  if (!puck.isEditing && (ended || !(hasText(title) || hasText(subtitle)))) return null

  const banner = variant === "banner"
  const heading = orHint(title, "Judul promo", puck)
  const lead = orHint(subtitle, "Isi dan syarat promonya", puck)
  let timing: ReactNode = null
  if (ended) {
    // Hanya terlihat di editor: pengunjung tidak lagi mendapat blok ini.
    timing = (
      <Badge variant="warning" radius="full" className="h-auto py-1 whitespace-normal">
        Promo sudah berakhir, jadi tidak tampil bagi pengunjung
      </Badge>
    )
  } else if (Number.isFinite(end)) {
    timing =
      countdown === "yes" ? (
        <Countdown left={end - now} />
      ) : (
        <span className={cn("text-sm font-medium", banner ? "opacity-90" : "text-muted-foreground")}>
          Berlaku sampai {new Date(end).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
        </span>
      )
  }
  const extras = code.trim() || timing || puck.isEditing

  const copy = (center: boolean) => (
    <div className={cn("flex flex-col gap-4", center ? "items-center text-center" : "items-start")}>
      {badge ? (
        <Badge radius="full" variant={banner ? "secondary" : "default"}>
          {badge}
        </Badge>
      ) : null}
      {heading ? <h2 className="page-title text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{heading}</h2> : null}
      {lead ? <p className={cn("page-lead max-w-xl text-lg text-pretty", banner ? "opacity-90" : "text-muted-foreground")}>{lead}</p> : null}
      {extras ? (
        <div className={cn("flex flex-wrap items-center gap-3", center && "justify-center")}>
          <PromoCode code={code} puck={puck} />
          {timing}
        </div>
      ) : null}
      <Buttons primary={{ label: props.button_label, link: props.button_link }} align={center ? "center" : "left"} puck={puck} />
    </div>
  )
  if (banner) {
    return (
      <Section>
        <ColorScope background="primary" className="relative isolate overflow-hidden rounded-3xl px-6 py-12 sm:px-12">
          <div aria-hidden="true" className="absolute -top-20 -right-20 -z-10 size-72 rounded-full bg-white/10" />
          <div aria-hidden="true" className="absolute -bottom-24 -left-16 -z-10 size-64 rounded-full bg-white/10" />
          {copy(true)}
        </ColorScope>
      </Section>
    )
  }
  if (variant === "split") {
    // Tanpa gambar (pengunjung): teksnya saja, tanpa separuh kisi yang kosong.
    const pictured = Boolean(image) || puck.isEditing
    return (
      <Section className={cn("grid items-center gap-10", pictured && "md:grid-cols-2")}>
        {copy(false)}
        {pictured ? <BlockImage src={image} alt="" className="aspect-4/3 w-full rounded-2xl shadow-lg" puck={puck} field="image" /> : null}
      </Section>
    )
  }
  return (
    <Section>
      <div className="mx-auto flex max-w-4xl flex-col overflow-hidden rounded-3xl border bg-card shadow-lg md:flex-row">
        {image || puck.isEditing ? (
          <BlockImage src={image} alt="" className="aspect-video w-full rounded-none border-0 md:aspect-auto md:w-2/5" puck={puck} field="image" />
        ) : null}
        <div className="flex-1 p-8">{copy(false)}</div>
      </div>
    </Section>
  )
}

const dateField = (label: string): CustomField<string> => ({
  type: "custom",
  label,
  metadata: { ai: { kind: "date" } },
  render: ({ id, value, onChange, readOnly }) => (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} type="date" value={value ?? ""} readOnly={readOnly} onChange={(event) => onChange(event.target.value)} />
    </Field>
  ),
})

export const promoConfig: ComponentConfig<PromoProps> = {
  label: "Promo",
  fields: {
    variant: layoutField<PromoProps["variant"]>("Susunan", [
      {
        value: "banner",
        label: "Pita berwarna",
        sketch: [p(4, 6, 52, 24), w(24, 10, 12), w(15, 13.5, 30, 2.6), w(20, 18.5, 20), c(20, 23, 9, 3), c(31, 23, 9, 3)],
      },
      { value: "card", label: "Kartu bergambar", sketch: [c(6, 5, 48, 26), i(6, 5, 18, 26), a(27, 9, 8, 2), t(27, 13, 22), s(27, 17.5, 18), b(27, 23)] },
      { value: "split", label: "Teks dan gambar", sketch: [a(4, 7, 8, 2), ...text(4, 11, 22), b(4, 22), i(32, 5, 24, 26)] },
    ]),
    badge: { type: "text", label: "Label kecil di atas judul", placeholder: "Misalnya: Promo" },
    title: inline({ type: "text", label: "Judul promo" }),
    subtitle: inline({ type: "textarea", label: "Isi dan syarat promo" }),
    code: { type: "text", label: "Kode promo (boleh kosong)", placeholder: "Kosongkan bila tanpa kode" },
    // Tanggal berakhir berlaku dengan atau tanpa hitung mundur: sesudahnya promo tidak tampil lagi.
    ends_at: dateField("Tanggal berakhir (boleh kosong; sesudahnya promo tidak tampil)"),
    countdown: yesNoField("Hitung mundur sampai tanggal berakhir"),
    button_label: { type: "text", label: "Teks tombol" },
    button_link: linkField,
    image: imageField("Gambar"),
  },
  resolveFields: showFields<PromoProps>({
    countdown: (props) => Boolean(props.ends_at),
    image: when("variant", "card", "split"),
  }),
  defaultProps: {
    variant: "banner",
    badge: "Promo",
    title: "",
    subtitle: "",
    code: "",
    countdown: "no",
    ends_at: "",
    button_label: "Hubungi kami",
    button_link: "#kontak",
    image: null,
  },
  render: (props) => <PromoBlock {...props} />,
}
