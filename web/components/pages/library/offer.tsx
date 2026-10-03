"use client"

import { useEffect, useState } from "react"
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
import { BlockImage, resolveLink, Section, useOverlayPortal, type BlockProps } from "../blocks"
import { EffectFrame, type CardEffect } from "../effects"
import { cardEffectOptions, imageField, introFields, layoutField, linkField, showFields, sk, when, yesNoField } from "../fields"
import { Buttons, lines, SectionIntro } from "./kit"

// Harga dan penawaran: daftar harga/menu, paket harga, tanya jawab, promo.

const { t, s, b, i, c, a, p, w, intro, text } = sk

// --- Daftar harga / menu --------------------------------------------------------------------

type PriceItem = { name: string; description: string; price: string; image: string | null; badge: string }

export type PriceListProps = {
  eyebrow: string
  title: string
  subtitle: string
  variant: "list" | "cards" | "compact"
  tabs: "yes" | "no"
  categories: { name: string; items: PriceItem[] }[]
  note: string
}

function PriceRow({ item, puck, photo }: { item: PriceItem; puck: BlockProps<unknown>["puck"]; photo: boolean }) {
  return (
    <li className="flex gap-4">
      {photo && item.image ? <BlockImage src={item.image} alt="" className="size-16 shrink-0 rounded-lg" puck={puck} /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold">{item.name}</span>
          {item.badge ? (
            <Badge variant="secondary" radius="full">
              {item.badge}
            </Badge>
          ) : null}
          {/* Garis titik-titik antara nama dan harga, seperti daftar menu. */}
          <span aria-hidden="true" className="mx-1 min-w-4 flex-1 translate-y-[-0.25em] border-b border-dotted border-muted-foreground/40" />
          <span className="font-semibold whitespace-nowrap tabular-nums">{item.price}</span>
        </div>
        {item.description ? <p className="text-sm text-pretty text-muted-foreground">{item.description}</p> : null}
      </div>
    </li>
  )
}

function PriceItems({ items, variant, puck }: { items: PriceItem[]; variant: PriceListProps["variant"]; puck: BlockProps<unknown>["puck"] }) {
  const shown = items.filter((item) => item.name.trim())
  if (variant === "cards") {
    return (
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((item, index) => (
          <li key={index} className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs">
            {item.image || puck.isEditing ? (
              <BlockImage src={item.image} alt="" className="aspect-4/3 w-full rounded-none border-0 border-b" puck={puck} />
            ) : null}
            <div className="flex flex-1 flex-col gap-2 p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="font-semibold">{item.name}</span>
                {item.badge ? (
                  <Badge variant="secondary" radius="full">
                    {item.badge}
                  </Badge>
                ) : null}
              </div>
              {item.description ? <p className="text-sm text-pretty text-muted-foreground">{item.description}</p> : null}
              <span className="mt-auto pt-2 text-lg font-semibold tabular-nums">{item.price}</span>
            </div>
          </li>
        ))}
      </ul>
    )
  }
  if (variant === "compact") {
    return (
      <ul className="divide-y rounded-xl border bg-card">
        {shown.map((item, index) => (
          <li key={index} className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="flex min-w-0 flex-col">
              <span className="font-medium">{item.name}</span>
              {item.description ? <span className="truncate text-sm text-muted-foreground">{item.description}</span> : null}
            </span>
            <span className="font-semibold whitespace-nowrap tabular-nums">{item.price}</span>
          </li>
        ))}
      </ul>
    )
  }
  return (
    <ul className="grid gap-x-12 gap-y-6 md:grid-cols-2">
      {shown.map((item, index) => (
        <PriceRow key={index} item={item} puck={puck} photo />
      ))}
    </ul>
  )
}

export function PriceListBlock({ eyebrow, title, subtitle, variant, tabs, categories, note, puck }: BlockProps<PriceListProps>) {
  const portal = useOverlayPortal(puck)
  const groups = categories.filter((category) => category.items.some((item) => item.name.trim()))
  return (
    <Section className="flex flex-col gap-10">
      <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
      {tabs === "yes" && groups.length > 1 ? (
        // Kategori bisa diklik langsung di editor (overlay portal).
        <Tabs defaultValue="0" className="gap-8">
          <TabsList ref={portal} className="mx-auto h-auto flex-wrap justify-center">
            {groups.map((group, index) => (
              <TabsTrigger key={index} value={String(index)} className="flex-none px-4">
                {group.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {groups.map((group, index) => (
            <TabsContent key={index} value={String(index)}>
              <PriceItems items={group.items} variant={variant} puck={puck} />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className="flex flex-col gap-10">
          {groups.map((group, index) => (
            <div key={index} className="flex flex-col gap-5">
              {group.name && groups.length > 1 ? <h3 className="text-xl font-semibold tracking-tight">{group.name}</h3> : null}
              <PriceItems items={group.items} variant={variant} puck={puck} />
            </div>
          ))}
        </div>
      )}
      {note ? <p className="text-center text-sm text-muted-foreground">{note}</p> : null}
    </Section>
  )
}

const priceItemFields = {
  name: { type: "text", label: "Nama" },
  price: { type: "text", label: "Harga", placeholder: "Rp25.000" },
  description: { type: "textarea", label: "Keterangan" },
  image: imageField("Foto (untuk susunan kartu dan daftar)"),
  badge: { type: "text", label: "Label", placeholder: "Favorit, Baru, Pedas…" },
} as const

const item = (name: string, price: string, description = "", badge = ""): PriceItem => ({ name, price, description, image: null, badge })

export const priceListConfig: ComponentConfig<PriceListProps> = {
  label: "Daftar harga / menu",
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
      defaultItemProps: { name: "Kategori", items: [item("Nama item", "Rp0")] },
      arrayFields: {
        name: { type: "text", label: "Nama kategori" },
        items: {
          type: "array",
          label: "Item",
          max: 40,
          getItemSummary: (entry) => [entry.name, entry.price].filter(Boolean).join(" · ") || "Item",
          defaultItemProps: item("Nama item", "Rp0"),
          arrayFields: priceItemFields,
        },
      },
    },
    note: { type: "text", label: "Catatan di bawah", placeholder: "Harga belum termasuk pajak." },
  },
  defaultProps: {
    eyebrow: "Menu",
    title: "Daftar harga",
    subtitle: "Harga bisa berubah sewaktu-waktu. Tanyakan promo hari ini.",
    variant: "list",
    tabs: "yes",
    categories: [
      {
        name: "Makanan",
        items: [
          item("Nasi goreng spesial", "Rp28.000", "Telur, ayam suwir, kerupuk.", "Favorit"),
          item("Mie ayam bakso", "Rp25.000", "Bakso sapi dan pangsit goreng."),
          item("Ayam geprek", "Rp22.000", "Sambal bawang, level 1–5.", "Pedas"),
        ],
      },
      { name: "Minuman", items: [item("Es teh manis", "Rp6.000"), item("Kopi susu gula aren", "Rp18.000", "", "Baru"), item("Jus alpukat", "Rp15.000")] },
    ],
    note: "",
  },
  render: (props) => <PriceListBlock {...props} />,
}

// --- Harga (paket) ---------------------------------------------------------------------------

type Plan = {
  name: string
  price: string
  price_yearly?: string
  period: string
  period_yearly?: string
  description: string
  features: string
  button_label: string
  button_link: string
  highlighted: "yes" | "no"
  badge: string
}

export type PricingProps = {
  eyebrow: string
  title: string
  subtitle: string
  variant: "cards" | "toggle" | "table" | "single"
  monthly_label: string
  yearly_label: string
  plans: Plan[]
  note: string
  featured_effect: CardEffect
}

function PlanButton({ plan, featured, puck, className }: { plan: Plan; featured: boolean; puck: BlockProps<unknown>["puck"]; className?: string }) {
  const target = resolveLink(plan.button_link, puck)
  if (!plan.button_label || !(target || puck.isEditing)) return null
  return (
    <a href={puck.isEditing ? undefined : target} className={cn(buttonVariants({ variant: featured ? "default" : "outline" }), "w-full", className)}>
      {plan.button_label}
    </a>
  )
}

function PlanCards({ plans, yearly, effect, puck }: { plans: Plan[]; yearly: boolean; effect: CardEffect; puck: BlockProps<unknown>["puck"] }) {
  return (
    <ul
      className={cn(
        "grid items-stretch gap-6",
        plans.length >= 3 ? "md:grid-cols-3" : plans.length === 2 ? "mx-auto w-full max-w-3xl md:grid-cols-2" : "mx-auto w-full max-w-md"
      )}
    >
      {plans.map((plan, index) => {
        const featured = plan.highlighted === "yes"
        const price = yearly ? plan.price_yearly || plan.price : plan.price
        const period = yearly ? plan.period_yearly || plan.period : plan.period
        return (
          <li key={index} className="flex">
            <EffectFrame effect={featured ? effect : "none"} className="flex flex-1 rounded-2xl">
              <div
                className={cn(
                  "relative flex flex-1 flex-col gap-6 rounded-2xl border bg-card p-6 shadow-xs",
                  featured && "border-(--page-accent) shadow-lg ring-1 ring-(--page-accent)"
                )}
              >
                {featured ? (
                  <Badge radius="full" className="absolute -top-2.5 left-6">
                    {plan.badge || "Paling laris"}
                  </Badge>
                ) : null}
                <div className="flex flex-col gap-2">
                  <h3 className="font-semibold">{plan.name}</h3>
                  <p className="flex items-baseline gap-1">
                    <span className="text-4xl font-semibold tracking-tight tabular-nums">{price}</span>
                    {period ? <span className="text-sm text-muted-foreground">{period}</span> : null}
                  </p>
                  {plan.description ? <p className="text-sm text-pretty text-muted-foreground">{plan.description}</p> : null}
                </div>
                <ul className="flex flex-col gap-2.5 text-sm">
                  {lines(plan.features).map((feature, position) => (
                    <li key={position} className="flex items-start gap-2.5">
                      <CheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
                      {feature}
                    </li>
                  ))}
                </ul>
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
function PlanTable({ plans, puck }: { plans: Plan[]; puck: BlockProps<unknown>["puck"] }) {
  const rows = [...new Set(plans.flatMap((plan) => lines(plan.features)))]
  const template = { gridTemplateColumns: `minmax(9rem, 1.6fr) repeat(${plans.length}, minmax(9rem, 1fr))` }
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-xs">
      <div role="table" aria-label="Perbandingan paket" className="min-w-fit text-sm">
        <div role="row" className="grid border-b" style={template}>
          <span role="columnheader" className="p-4" />
          {plans.map((plan, index) => (
            <div key={index} role="columnheader" className={cn("flex flex-col gap-1 p-4", plan.highlighted === "yes" && "bg-muted/60")}>
              <span className="font-semibold">{plan.name}</span>
              <span className="text-xl font-semibold tracking-tight break-words tabular-nums sm:text-2xl">{plan.price}</span>
              {plan.period ? <span className="text-xs text-muted-foreground">{plan.period}</span> : null}
            </div>
          ))}
        </div>
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

function SinglePlan({ plan, puck }: { plan: Plan; puck: BlockProps<unknown>["puck"] }) {
  return (
    <div className="mx-auto grid w-full max-w-4xl overflow-hidden rounded-3xl border bg-card shadow-lg md:grid-cols-[1fr_1.2fr]">
      <div className="flex flex-col gap-4 border-b bg-muted/50 p-8 md:border-r md:border-b-0">
        {plan.badge ? (
          <Badge radius="full" className="self-start">
            {plan.badge}
          </Badge>
        ) : null}
        <h3 className="text-xl font-semibold">{plan.name}</h3>
        {plan.description ? <p className="text-sm text-pretty text-muted-foreground">{plan.description}</p> : null}
        <p className="flex items-baseline gap-1">
          <span className="text-5xl font-semibold tracking-tight tabular-nums">{plan.price}</span>
          {plan.period ? <span className="text-muted-foreground">{plan.period}</span> : null}
        </p>
        <PlanButton plan={plan} featured puck={puck} className="mt-auto" />
      </div>
      <div className="flex flex-col gap-4 p-8">
        <span className="text-sm font-medium">Yang Anda dapat</span>
        <ul className="grid gap-3 text-sm sm:grid-cols-2">
          {lines(plan.features).map((feature, position) => (
            <li key={position} className="flex items-start gap-2.5">
              <CheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function PricingBlock(props: BlockProps<PricingProps>) {
  const { eyebrow, title, subtitle, variant, plans, note, featured_effect, puck } = props
  const [yearly, setYearly] = useState(false)
  const portal = useOverlayPortal(puck)
  let body
  if (variant === "table") body = <PlanTable plans={plans} puck={puck} />
  else if (variant === "single") {
    const plan = plans.find((entry) => entry.highlighted === "yes") ?? plans[0]
    body = plan ? <SinglePlan plan={plan} puck={puck} /> : null
  } else {
    body = (
      <>
        {variant === "toggle" ? (
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
        <PlanCards plans={plans} yearly={variant === "toggle" && yearly} effect={featured_effect} puck={puck} />
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

const plan = (name: string, price: string, yearly: string, description: string, features: string, highlighted: "yes" | "no", badge = ""): Plan => ({
  name,
  price,
  price_yearly: yearly,
  period: price.startsWith("Rp") ? "/bulan" : "",
  period_yearly: yearly.startsWith("Rp") ? "/bulan, ditagih tahunan" : "",
  description,
  features,
  button_label: `Pilih ${name}`,
  button_link: "#kontak",
  highlighted,
  badge,
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
    monthly_label: { type: "text", label: "Label pilihan bulanan" },
    yearly_label: { type: "text", label: "Label pilihan tahunan", placeholder: "Tahunan · hemat 20%" },
    plans: {
      type: "array",
      label: "Paket",
      max: 5,
      getItemSummary: (entry) => entry.name || "Paket tanpa nama",
      defaultItemProps: plan("Paket", "Rp0", "", "", "", "no"),
      arrayFields: {
        name: { type: "text", label: "Nama paket" },
        price: { type: "text", label: "Harga", placeholder: "Misalnya: Rp150.000" },
        period: { type: "text", label: "Keterangan harga", placeholder: "Misalnya: /bulan" },
        price_yearly: { type: "text", label: "Harga tahunan (untuk susunan bulanan/tahunan)", placeholder: "Rp120.000" },
        period_yearly: { type: "text", label: "Keterangan harga tahunan" },
        description: { type: "textarea", label: "Untuk siapa" },
        features: { type: "textarea", label: "Isi paket (satu per baris)" },
        button_label: { type: "text", label: "Teks tombol" },
        button_link: linkField,
        highlighted: yesNoField("Tonjolkan paket ini"),
        badge: { type: "text", label: "Label paket", placeholder: "Paling laris" },
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
    subtitle: "Harga jelas sejak awal. Bisa berubah paket kapan saja.",
    variant: "cards",
    monthly_label: "Bulanan",
    yearly_label: "Tahunan · hemat 20%",
    plans: [
      plan("Dasar", "Rp150.000", "Rp120.000", "Untuk yang baru mulai.", "Satu layanan pilihan\nDukungan lewat chat", "no"),
      plan(
        "Usaha",
        "Rp350.000",
        "Rp280.000",
        "Untuk usaha yang sedang tumbuh.",
        "Satu layanan pilihan\nDukungan lewat chat\nSemua layanan\nDukungan prioritas\nLaporan bulanan",
        "yes",
        "Paling laris"
      ),
      plan(
        "Lengkap",
        "Hubungi kami",
        "",
        "Untuk kebutuhan khusus.",
        "Satu layanan pilihan\nDukungan lewat chat\nSemua layanan\nDukungan prioritas\nLaporan bulanan\nPendamping khusus",
        "no"
      ),
    ],
    note: "",
    featured_effect: "none",
  },
  render: (props) => <PricingBlock {...props} />,
}

// --- Tanya jawab -------------------------------------------------------------------------------

export type FaqProps = {
  eyebrow: string
  title: string
  subtitle: string
  variant: "single" | "two" | "side" | "contact"
  items: { question: string; answer: string }[]
  contact_title: string
  contact_text: string
  contact_label: string
  contact_link: string
}

function FaqAccordion({ items, puck }: { items: FaqProps["items"]; puck: BlockProps<unknown>["puck"] }) {
  const portal = useOverlayPortal(puck)
  return (
    <Accordion className="rounded-xl border bg-card px-5">
      {items.map((entry, index) => (
        <AccordionItem key={index} value={String(index)}>
          <AccordionTrigger ref={portal} className="text-base">
            {entry.question}
          </AccordionTrigger>
          <AccordionContent>
            <p className="whitespace-pre-line text-muted-foreground">{entry.answer}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

export function FaqBlock(props: BlockProps<FaqProps>) {
  const { eyebrow, title, subtitle, variant, items, puck } = props
  if (variant === "two") {
    return (
      <Section className="flex flex-col gap-12">
        <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
        <dl className="grid gap-x-12 gap-y-8 md:grid-cols-2">
          {items.map((entry, index) => (
            <div key={index} className="flex flex-col gap-2">
              <dt className="font-semibold">{entry.question}</dt>
              <dd className="whitespace-pre-line text-pretty text-muted-foreground">{entry.answer}</dd>
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
        <FaqAccordion items={items} puck={puck} />
      </Section>
    )
  }
  return (
    <Section className="flex max-w-3xl flex-col gap-10">
      <SectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <FaqAccordion items={items} puck={puck} />
      {variant === "contact" ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-muted px-6 py-8 text-center">
          <h3 className="text-lg font-semibold">{props.contact_title}</h3>
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
      defaultItemProps: { question: "Pertanyaan?", answer: "Jawabannya." },
      arrayFields: { question: { type: "text", label: "Pertanyaan" }, answer: { type: "textarea", label: "Jawaban" } },
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
    items: [
      { question: "Berapa lama pengerjaannya?", answer: "Biasanya satu sampai dua minggu, tergantung jumlahnya." },
      { question: "Bisa dikirim ke luar kota?", answer: "Bisa. Ongkos kirim dihitung saat pemesanan." },
      { question: "Bagaimana cara membayar?", answer: "Transfer bank, QRIS, atau tunai di tempat." },
    ],
    contact_title: "Masih ada pertanyaan?",
    contact_text: "Tim kami siap membantu lewat WhatsApp pada jam kerja.",
    contact_label: "Hubungi kami",
    contact_link: "#kontak",
  },
  render: (props) => <FaqBlock {...props} />,
}

// --- Promo -----------------------------------------------------------------------------------

export type PromoProps = {
  variant: "banner" | "card" | "split"
  badge: string
  title: string
  subtitle: string
  code: string
  ends_at: string
  countdown: "yes" | "no"
  button_label: string
  button_link: string
  image: string | null
}

/** Sisa waktu sampai akhir hari `date` (YYYY-MM-DD, waktu setempat). */
function useCountdown(date: string, enabled: boolean) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    if (!enabled || !date) return
    const tick = () => setNow(Date.now())
    const first = window.setTimeout(tick, 0)
    const timer = window.setInterval(tick, 1000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [date, enabled])
  const end = date ? new Date(`${date}T23:59:59`).getTime() : NaN
  if (!enabled || now === null || Number.isNaN(end)) return null
  const left = Math.max(end - now, 0)
  return {
    days: Math.floor(left / 86_400_000),
    hours: Math.floor(left / 3_600_000) % 24,
    minutes: Math.floor(left / 60_000) % 60,
    seconds: Math.floor(left / 1000) % 60,
  }
}

function Countdown({ date, enabled }: { date: string; enabled: boolean }) {
  const left = useCountdown(date, enabled)
  if (!left) return null
  const parts = [
    { value: left.days, label: "hari" },
    { value: left.hours, label: "jam" },
    { value: left.minutes, label: "menit" },
    { value: left.seconds, label: "detik" },
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

function PromoCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  if (!code) return null
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-dashed bg-background/70 py-1 pr-1 pl-3 text-foreground">
      <TicketPercentIcon aria-hidden="true" className="size-4 text-muted-foreground" />
      <span className="font-mono font-semibold tracking-wider">{code}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={copied ? "Kode tersalin" : "Salin kode promo"}
        onClick={() => {
          void navigator.clipboard?.writeText(code)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2000)
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </span>
  )
}

export function PromoBlock(props: BlockProps<PromoProps>) {
  const { variant, badge, title, subtitle, code, ends_at, countdown, image, puck } = props
  const copy = (center: boolean) => (
    <div className={cn("flex flex-col gap-4", center ? "items-center text-center" : "items-start")}>
      {badge ? (
        <Badge radius="full" variant={variant === "banner" ? "secondary" : "default"}>
          {badge}
        </Badge>
      ) : null}
      <h2 className="page-title text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {subtitle ? (
        <p className={cn("page-lead max-w-xl text-lg text-pretty", variant === "banner" ? "opacity-90" : "text-muted-foreground")}>{subtitle}</p>
      ) : null}
      <div className={cn("flex flex-wrap items-center gap-3", center && "justify-center")}>
        <PromoCode code={code} />
        <Countdown date={ends_at} enabled={countdown === "yes"} />
      </div>
      <Buttons primary={{ label: props.button_label, link: props.button_link }} align={center ? "center" : "left"} puck={puck} />
    </div>
  )
  if (variant === "banner") {
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
    return (
      <Section className="grid items-center gap-10 md:grid-cols-2">
        {copy(false)}
        <BlockImage src={image} alt="" className="aspect-4/3 w-full rounded-2xl shadow-lg" puck={puck} />
      </Section>
    )
  }
  return (
    <Section>
      <div className="mx-auto flex max-w-4xl flex-col overflow-hidden rounded-3xl border bg-card shadow-lg md:flex-row">
        {image || puck.isEditing ? (
          <BlockImage src={image} alt="" className="aspect-video w-full rounded-none border-0 md:aspect-auto md:w-2/5" puck={puck} />
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
    badge: { type: "text", label: "Label", placeholder: "Diskon 20%" },
    title: { type: "text", label: "Judul promo" },
    subtitle: { type: "textarea", label: "Keterangan" },
    code: { type: "text", label: "Kode promo (boleh kosong)", placeholder: "HEMAT20" },
    countdown: yesNoField("Hitung mundur"),
    ends_at: dateField("Berakhir pada"),
    button_label: { type: "text", label: "Teks tombol" },
    button_link: linkField,
    image: imageField("Gambar"),
  },
  resolveFields: showFields<PromoProps>({
    ends_at: when("countdown", "yes"),
    image: when("variant", "card", "split"),
  }),
  defaultProps: {
    variant: "banner",
    badge: "Promo terbatas",
    title: "Diskon 20% untuk pesanan pertama",
    subtitle: "Pakai kodenya saat memesan lewat WhatsApp.",
    code: "HEMAT20",
    countdown: "no",
    ends_at: "",
    button_label: "Pesan sekarang",
    button_link: "#kontak",
    image: null,
  },
  render: (props) => <PromoBlock {...props} />,
}
