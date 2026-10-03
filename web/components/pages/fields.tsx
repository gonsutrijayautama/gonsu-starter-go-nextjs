"use client"

import type { CustomField, DefaultComponentProps, Fields } from "@puckeditor/core"

import { Field, FieldLabel } from "@/components/ui/field"

import { ImageInput } from "./image-input"
import { OptionPicker } from "./option-picker"

// Isian Puck yang dipakai banyak blok, pemilih susunan bergambar, dan aturan
// isian yang hanya tampil untuk susunan tertentu.

export const imageField = (label: string): CustomField<string | null> => ({
  type: "custom",
  label,
  metadata: { ai: { kind: "image" } },
  render: ({ id, value, onChange, readOnly }) => (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <ImageInput id={id} value={value ?? null} onChange={onChange} readOnly={readOnly} />
    </Field>
  ),
})

export const linkField = { type: "text", label: "Tautan tombol", placeholder: "/layanan, #kontak, atau https://…" } as const

export const alignField = {
  type: "radio",
  label: "Perataan",
  options: [
    { label: "Kiri", value: "left" },
    { label: "Tengah", value: "center" },
    { label: "Kanan", value: "right" },
  ],
} as const

/** Ya/tidak: tampil sebagai sakelar di panel (editor-fields). */
export const yesNoField = (label: string) =>
  ({
    type: "radio",
    label,
    options: [
      { label: "Ya", value: "yes" },
      { label: "Tidak", value: "no" },
    ],
  }) as const

export const introFields = {
  eyebrow: { type: "text", label: "Label kecil di atas judul", placeholder: "Kosongkan bila tidak perlu" },
  title: { type: "text", label: "Judul bagian" },
  subtitle: { type: "textarea", label: "Kalimat di bawah judul" },
} as const

export const backgroundField = {
  type: "select",
  label: "Latar",
  options: [
    { label: "Cahaya", value: "glow" },
    { label: "Kisi", value: "grid" },
    { label: "Titik-titik", value: "dots" },
    { label: "Garis miring", value: "stripes" },
    { label: "Aurora (bergerak)", value: "aurora" },
    { label: "Retro grid (bergerak)", value: "retro" },
    { label: "Riak (bergerak)", value: "ripple" },
    { label: "Meteor (bergerak)", value: "meteors" },
    { label: "Sinar cahaya (bergerak)", value: "rays" },
    { label: "Kisi berkedip (bergerak)", value: "flicker" },
    { label: "Polos", value: "none" },
  ],
} as const

export const buttonEffectField = {
  type: "select",
  label: "Efek tombol utama",
  options: [
    { label: "Tanpa efek", value: "none" },
    { label: "Mengilap", value: "shine" },
    { label: "Cahaya berputar di tepi", value: "shimmer" },
    { label: "Pelangi", value: "rainbow" },
    { label: "Berdenyut", value: "pulse" },
  ],
} as const

export const cardEffectOptions = [
  { label: "Tanpa efek", value: "none" },
  { label: "Cahaya berjalan di tepi", value: "beam" },
  { label: "Tepi berkilau warna-warni", value: "shine" },
  { label: "Neon berpendar", value: "neon" },
  { label: "Sorot mengikuti kursor", value: "spotlight" },
]

export const effectField = {
  type: "select",
  label: "Efek kata yang disorot",
  options: [
    { label: "Gradien bergerak", value: "gradient" },
    { label: "Kilau", value: "shine" },
    { label: "Aurora warna-warni", value: "aurora" },
    { label: "Berganti-ganti (pisahkan kata dengan koma)", value: "rotate" },
    { label: "Diketik (pisahkan kata dengan koma)", value: "typing" },
    { label: "Warna utama saja", value: "accent" },
  ],
} as const

export const numberFormatField = {
  type: "select",
  label: "Format angka",
  options: [
    { label: "Biasa (1.250)", value: "plain" },
    { label: "Ringkas (1,2 rb · 3,5 jt)", value: "compact" },
    { label: "Persen (98%)", value: "percent" },
    { label: "Rupiah (Rp1.250.000)", value: "currency" },
    { label: "Desimal (4,9)", value: "decimal" },
  ],
} as const

export const decimalsField = { type: "number", label: "Angka di belakang koma", min: 0, max: 3 } as const

export const animateField = yesNoField("Hitung naik saat terlihat")

// --- Sketsa susunan ----------------------------------------------------------------------------

/**
 * Satu bentuk sketsa di kanvas 60×36: jenis, x, y, lebar, tinggi.
 * t judul · s teks · b tombol utama · g tombol garis · i gambar · c kartu ·
 * a aksen · o lingkaran (foto/ikon) · d latar gelap · p latar warna utama ·
 * w teks terang (di atas latar gelap atau berwarna).
 */
export type Shape = readonly ["t" | "s" | "b" | "g" | "i" | "c" | "a" | "o" | "d" | "p" | "w", number, number, number, number]

const shapeClass: Record<Shape[0], string> = {
  t: "fill-foreground/75",
  s: "fill-muted-foreground/40",
  b: "fill-primary",
  g: "fill-none stroke-muted-foreground/70 stroke-[0.6]",
  i: "fill-muted-foreground/25",
  c: "fill-background stroke-muted-foreground/45 stroke-[0.6]",
  a: "fill-primary/25",
  o: "fill-muted-foreground/40",
  d: "fill-foreground/80",
  p: "fill-primary/90",
  w: "fill-background/85",
}

export function Sketch({ shapes }: { shapes: readonly Shape[] }) {
  return (
    // size-full: tombol pilihan memperkecil setiap svg tanpa kelas size-* menjadi ikon.
    <span className="block aspect-[60/36] w-full overflow-hidden rounded-md border bg-background">
      <svg viewBox="0 0 60 36" aria-hidden="true" className="size-full">
        {shapes.map(([kind, x, y, w, h], index) =>
          kind === "o" ? (
            <ellipse key={index} cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} className={shapeClass.o} />
          ) : (
            <rect
              key={index}
              x={x}
              y={y}
              width={w}
              height={h}
              rx={kind === "b" || kind === "g" ? h / 2 : kind === "t" || kind === "s" || kind === "w" ? Math.min(h / 2, 0.8) : 1.5}
              className={shapeClass[kind]}
            />
          )
        )}
      </svg>
    </span>
  )
}

/** Pembantu sketsa: judul, dua baris teks, dan tombol, rata kiri atau tengah. */
export const sk = {
  t: (x: number, y: number, w: number): Shape => ["t", x, y, w, 2.6],
  s: (x: number, y: number, w: number): Shape => ["s", x, y, w, 1.3],
  b: (x: number, y: number, w = 9): Shape => ["b", x, y, w, 3],
  g: (x: number, y: number, w = 9): Shape => ["g", x, y, w, 3],
  i: (x: number, y: number, w: number, h: number): Shape => ["i", x, y, w, h],
  c: (x: number, y: number, w: number, h: number): Shape => ["c", x, y, w, h],
  a: (x: number, y: number, w: number, h: number): Shape => ["a", x, y, w, h],
  o: (x: number, y: number, d: number): Shape => ["o", x, y, d, d],
  d: (x: number, y: number, w: number, h: number): Shape => ["d", x, y, w, h],
  p: (x: number, y: number, w: number, h: number): Shape => ["p", x, y, w, h],
  w: (x: number, y: number, w: number, h = 1.3): Shape => ["w", x, y, w, h],
  /** Judul + dua baris, berpusat di `cx`. */
  intro: (cx: number, y: number, w = 26): Shape[] => [
    ["t", cx - w / 2, y, w, 2.6],
    ["s", cx - w * 0.4, y + 4.2, w * 0.8, 1.3],
  ],
  /** Judul + dua baris, rata kiri dari `x`. */
  text: (x: number, y: number, w = 22): Shape[] => [
    ["t", x, y, w, 2.6],
    ["s", x, y + 4.2, w * 0.9, 1.3],
    ["s", x, y + 6.6, w * 0.7, 1.3],
  ],
}

export type LayoutOption<V extends string> = { value: V; label: string; sketch: readonly Shape[] }

/** Pemilih susunan: petak bergambar sketsa, satu klik. */
export function layoutField<V extends string>(label: string, options: LayoutOption<V>[], columns = 2): CustomField<V> {
  const items = options.map((option) => ({ value: option.value, label: option.label, preview: <Sketch shapes={option.sketch} /> }))
  return {
    type: "custom",
    label,
    // Untuk katalog AI (ai/catalog.ts): pilihan susunan beserta namanya.
    metadata: { ai: { kind: "enum", options: options.map(({ value, label: name }) => ({ value, label: name })) } },
    render: ({ id, value, onChange, readOnly }) => (
      <OptionPicker
        id={id}
        label={label}
        value={value ?? options[0]!.value}
        options={items}
        onChange={onChange}
        disabled={readOnly}
        layout="tiles"
        columns={columns}
      />
    ),
  }
}

/**
 * Isian yang hanya tampil bila aturannya terpenuhi, misalnya gambar latar
 * hanya untuk susunan "Gambar latar". Isian tanpa aturan selalu tampil.
 * Nilainya tetap tersimpan, jadi berganti susunan bolak-balik tidak menghapus isi.
 */
export function showFields<P extends DefaultComponentProps>(rules: Partial<Record<keyof P, (props: P) => boolean>>) {
  return (data: { props: unknown }, params: { fields: Fields<P> }): Fields<P> => {
    const props = data.props as P
    const entries = Object.entries(params.fields).filter(([key]) => {
      const rule = rules[key as keyof P]
      return !rule || rule(props)
    })
    return Object.fromEntries(entries) as Fields<P>
  }
}

/** Aturan: susunan (`key`) salah satu dari `values`. */
export function when<P extends DefaultComponentProps, K extends keyof P>(key: K, ...values: P[K][]) {
  return (props: P) => values.includes(props[key])
}
