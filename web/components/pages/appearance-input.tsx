"use client"

import type { CSSProperties, ReactNode } from "react"
import {
  AlignVerticalJustifyCenterIcon,
  AlignVerticalJustifyEndIcon,
  AlignVerticalJustifyStartIcon,
  ArrowDownIcon,
  ArrowDownRightIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  BanIcon,
  CheckIcon,
  CrosshairIcon,
  FoldVerticalIcon,
  Grid2x2Icon,
  Grid3x3Icon,
  GripIcon,
  ImageIcon,
  LayoutGridIcon,
  MonitorIcon,
  MonitorSmartphoneIcon,
  MoonIcon,
  RadarIcon,
  RectangleVerticalIcon,
  SlashIcon,
  SlidersHorizontalIcon,
  SmartphoneIcon,
  SparklesIcon,
  SunIcon,
  SunriseIcon,
  WandSparklesIcon,
  WavesIcon,
} from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Switch } from "@/components/ui/switch"

import { anchorOf, appearanceOf, textOn, type Appearance } from "./appearance"
import { ColorPicker, SizeSlider } from "./field-kit"
import { ImageInput } from "./image-input"
import { MotionInput } from "./motion-input"
import { OptionPicker, type Option, type PickerLayout } from "./option-picker"

// Isi tab "Tampilan" di panel kanan editor: seluruh objek `appearance` satu
// blok. Pilihan yang tidak berlaku (warna saat latar gambar, dan sebaliknya)
// tidak ditampilkan. Pilihan memakai OptionPicker: tombol, petak ikon, dan
// pratinjau warna, supaya satu klik cukup.

export type { Option }

/** Ikon lebar isi: kotak halaman dengan isi selebar `inner` dari 22. */
function widthGlyph(inner: number) {
  return function WidthGlyph({ className }: { className?: string }) {
    return (
      <svg viewBox="0 0 24 16" fill="none" aria-hidden="true" className={cn(className, "h-4 w-6")}>
        <rect x="0.75" y="0.75" width="22.5" height="14.5" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
        <rect x={12 - inner / 2} y="4.5" width={inner} height="7" rx="1" fill="currentColor" />
      </svg>
    )
  }
}

/** Pratinjau warna latar di petak pilihan. */
function Dot({ className, style, children }: { className?: string; style?: CSSProperties; children?: ReactNode }) {
  return (
    <span aria-hidden="true" className={cn("flex size-5 items-center justify-center rounded-full border", className)} style={style}>
      {children}
    </span>
  )
}

const widthOptions: Option<Appearance["width"]>[] = [
  { value: "default", label: "Bawaan blok", short: "Bawaan", icon: WandSparklesIcon },
  { value: "narrow", label: "Sempit", icon: widthGlyph(7) },
  { value: "normal", label: "Biasa", icon: widthGlyph(12) },
  { value: "wide", label: "Lebar", icon: widthGlyph(17) },
  { value: "full", label: "Penuh selebar layar", short: "Penuh", icon: widthGlyph(22) },
]

const heightOptions: Option<Appearance["height"]>[] = [
  { value: "auto", label: "Mengikuti isi", short: "Ikut isi", icon: FoldVerticalIcon },
  { value: "large", label: "Tinggi (70% layar)", short: "70%", icon: RectangleVerticalIcon },
  { value: "screen", label: "Setinggi layar", short: "Layar", icon: MonitorIcon },
  { value: "custom", label: "Atur sendiri", short: "Atur", icon: SlidersHorizontalIcon },
]

const valignOptions: Option<Appearance["valign"]>[] = [
  { value: "top", label: "Atas", icon: AlignVerticalJustifyStartIcon },
  { value: "center", label: "Tengah", icon: AlignVerticalJustifyCenterIcon },
  { value: "bottom", label: "Bawah", icon: AlignVerticalJustifyEndIcon },
]

const spacingOptions: Option<Appearance["spacing"]>[] = [
  { value: "default", label: "Bawaan blok", short: "Bawaan" },
  { value: "none", label: "Tanpa jarak", short: "Tanpa" },
  { value: "small", label: "Kecil" },
  { value: "medium", label: "Sedang" },
  { value: "large", label: "Besar" },
  { value: "custom", label: "Atur sendiri", short: "Atur" },
]

const backgroundOptions: Option<Appearance["background"]>[] = [
  { value: "none", label: "Polos", preview: <Dot className="bg-background" /> },
  { value: "muted", label: "Abu-abu lembut", short: "Lembut", preview: <Dot className="bg-muted" /> },
  { value: "card", label: "Kartu", preview: <Dot className="bg-card shadow-sm" /> },
  { value: "primary", label: "Warna utama", short: "Utama", preview: <Dot className="border-transparent bg-primary" /> },
  { value: "inverse", label: "Gelap", preview: <Dot className="border-transparent bg-invert" /> },
  {
    value: "color",
    label: "Warna pilihan sendiri",
    short: "Warna",
    preview: <Dot className="border-transparent" style={{ background: "conic-gradient(#f59e0b, #ec4899, #6366f1, #22c55e, #f59e0b)" }} />,
  },
  {
    value: "gradient",
    label: "Gradien dua warna",
    short: "Gradien",
    preview: <Dot className="border-transparent" style={{ background: "linear-gradient(135deg, #0ea5e9, #6366f1)" }} />,
  },
  {
    value: "image",
    label: "Gambar",
    preview: (
      <Dot className="bg-muted">
        <ImageIcon className="size-3" />
      </Dot>
    ),
  },
]

const directionOptions: Option<Appearance["direction"]>[] = [
  { value: "diagonal", label: "Miring", icon: ArrowDownRightIcon },
  { value: "down", label: "Atas ke bawah", icon: ArrowDownIcon },
  { value: "right", label: "Kiri ke kanan", icon: ArrowRightIcon },
  { value: "radial", label: "Memancar dari atas", icon: SunriseIcon },
]

const focusOptions: Option<Appearance["focus"]>[] = [
  { value: "center", label: "Tengah", icon: CrosshairIcon },
  { value: "top", label: "Atas", icon: ArrowUpIcon },
  { value: "bottom", label: "Bawah", icon: ArrowDownIcon },
  { value: "left", label: "Kiri", icon: ArrowLeftIcon },
  { value: "right", label: "Kanan", icon: ArrowRightIcon },
]

const overlayOptions: Option<Appearance["overlay"]>[] = [
  { value: "dark", label: "Gelapkan (teks putih)", short: "Gelap", icon: MoonIcon },
  { value: "light", label: "Terangkan (teks hitam)", short: "Terang", icon: SunIcon },
  { value: "none", label: "Tanpa lapisan", short: "Tanpa", icon: BanIcon },
]

const strengthOptions: Option<Appearance["strength"]>[] = [
  { value: "soft", label: "Tipis" },
  { value: "medium", label: "Sedang" },
  { value: "strong", label: "Tebal" },
]

const patternOptions: Option<Appearance["pattern"]>[] = [
  { value: "none", label: "Tanpa pola", short: "Tanpa", icon: BanIcon },
  { value: "grid", label: "Kisi", icon: Grid3x3Icon },
  { value: "dots", label: "Titik-titik", short: "Titik", icon: GripIcon },
  { value: "stripes", label: "Garis miring", short: "Garis", icon: SlashIcon },
  { value: "glow", label: "Cahaya", icon: SunIcon },
  { value: "aurora", label: "Aurora (bergerak)", short: "Aurora", icon: WavesIcon },
  { value: "retro", label: "Retro grid (bergerak)", short: "Retro", icon: Grid2x2Icon },
  { value: "ripple", label: "Riak (bergerak)", short: "Riak", icon: RadarIcon },
  { value: "meteors", label: "Meteor (bergerak)", short: "Meteor", icon: SparklesIcon },
  { value: "rays", label: "Sinar cahaya (bergerak)", short: "Sinar", icon: SunriseIcon },
  { value: "flicker", label: "Kisi berkedip (bergerak)", short: "Kedip", icon: LayoutGridIcon },
]

const visibilityOptions: Option<Appearance["visibility"]>[] = [
  { value: "all", label: "Semua layar", short: "Semua", icon: MonitorSmartphoneIcon },
  { value: "desktop", label: "Hanya komputer", short: "Komputer", icon: MonitorIcon },
  { value: "mobile", label: "Hanya ponsel", short: "Ponsel", icon: SmartphoneIcon },
]

/** Warna latar siap pilih: lembut terang dan pekat gelap. */
const swatches = [
  { label: "Krem", color: "#f4efe6" },
  { label: "Pasir", color: "#e9dcc4" },
  { label: "Mint", color: "#dff3e7" },
  { label: "Langit", color: "#dcebfb" },
  { label: "Lavender", color: "#e9e3fb" },
  { label: "Mawar", color: "#fbe2e6" },
  { label: "Arang", color: "#1f2023" },
  { label: "Biru tua", color: "#1e2a4a" },
  { label: "Hijau tua", color: "#1f3b2d" },
  { label: "Marun", color: "#4a1d2a" },
]

/** Gradien siap pilih. */
export const gradients = [
  { label: "Senja", from: "#f59e0b", to: "#ec4899" },
  { label: "Laut", from: "#0ea5e9", to: "#6366f1" },
  { label: "Hutan", from: "#34d399", to: "#065f46" },
  { label: "Fajar", from: "#fdf2f8", to: "#eef2ff" },
  { label: "Pasir pantai", from: "#fef3c7", to: "#fde2e4" },
  { label: "Malam", from: "#0f172a", to: "#4c1d95" },
]

/** Satu pilihan berlabel: tombol, petak ikon, atau dropdown menurut panjang daftarnya. */
export function Choice<V extends string>(props: {
  id: string
  label: string
  value: V
  options: Option<V>[]
  onChange: (value: V) => void
  disabled?: boolean
  layout?: PickerLayout
  columns?: number
}) {
  return <OptionPicker {...props} />
}

export function Swatch({ label, background, foreground, picked, onClick, disabled }: { label: string; background: string; foreground: string; picked: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      aria-pressed={picked}
      disabled={disabled}
      onClick={onClick}
      className="rounded-full"
      style={{ background, color: foreground }}
    >
      {picked ? <CheckIcon /> : null}
    </Button>
  )
}

/** Pengaturan Tampilan satu bagian halaman. */
export function AppearanceInput({ id, value, onChange, readOnly }: { id: string; value: Partial<Appearance> | undefined; onChange: (value: Appearance) => void; readOnly?: boolean }) {
  const look = appearanceOf(value)
  const set = <K extends keyof Appearance>(key: K, next: Appearance[K]) => onChange({ ...look, [key]: next })
  const custom = look.background === "color" || look.background === "gradient"

  return (
    <div className="flex flex-col gap-8">
      <FieldSet>
        <FieldLegend>Ukuran</FieldLegend>
        <FieldGroup className="gap-5">
          <Choice id={`${id}-width`} label="Lebar isi" value={look.width} options={widthOptions} onChange={(next) => set("width", next)} disabled={readOnly} />
          <Choice id={`${id}-height`} label="Tinggi bagian" value={look.height} options={heightOptions} onChange={(next) => set("height", next)} disabled={readOnly} />
          {look.height === "custom" ? (
            <SizeSlider id={`${id}-height-vh`} label="Tinggi" value={look.heightVh} onChange={(next) => set("heightVh", next || 60)} min={20} max={100} unit="% layar" fallback={60} disabled={readOnly} />
          ) : null}
          {look.height !== "auto" ? (
            <Choice id={`${id}-valign`} label="Letak isi" value={look.valign} options={valignOptions} onChange={(next) => set("valign", next)} disabled={readOnly} />
          ) : null}
          <Choice id={`${id}-spacing`} label="Jarak atas-bawah" value={look.spacing} options={spacingOptions} onChange={(next) => set("spacing", next)} disabled={readOnly} />
          {look.spacing === "custom" ? (
            <>
              <SizeSlider id={`${id}-space-top`} label="Jarak atas" value={look.spaceTop} onChange={(next) => set("spaceTop", next)} min={0} max={240} step={4} unit="px" fallback={64} disabled={readOnly} />
              <SizeSlider id={`${id}-space-bottom`} label="Jarak bawah" value={look.spaceBottom} onChange={(next) => set("spaceBottom", next)} min={0} max={240} step={4} unit="px" fallback={64} disabled={readOnly} />
            </>
          ) : null}
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Latar</FieldLegend>
        <FieldGroup className="gap-5">
          <Choice id={`${id}-background`} label="Jenis latar" value={look.background} options={backgroundOptions} onChange={(next) => set("background", next)} disabled={readOnly} columns={4} />

          {look.background === "color" ? (
            <Field>
              <FieldLabel htmlFor={`${id}-color`}>Warna</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {swatches.map((swatch) => (
                  <Swatch
                    key={swatch.color}
                    label={swatch.label}
                    background={swatch.color}
                    foreground={textOn(swatch.color)}
                    picked={swatch.color.toLowerCase() === look.color.toLowerCase()}
                    onClick={() => set("color", swatch.color)}
                    disabled={readOnly}
                  />
                ))}
              </div>
              <ColorPicker id={`${id}-color`} value={look.color} onChange={(next) => set("color", next)} disabled={readOnly} allowAuto={false} />
            </Field>
          ) : null}

          {look.background === "gradient" ? (
            <>
              <Field>
                <FieldLabel htmlFor={`${id}-from`}>Gradien</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {gradients.map((gradient) => (
                    <Swatch
                      key={gradient.label}
                      label={gradient.label}
                      background={`linear-gradient(135deg, ${gradient.from}, ${gradient.to})`}
                      foreground={textOn(gradient.from, gradient.to)}
                      picked={gradient.from === look.color.toLowerCase() && gradient.to === look.color2.toLowerCase()}
                      onClick={() => onChange({ ...look, color: gradient.from, color2: gradient.to })}
                      disabled={readOnly}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ColorPicker id={`${id}-from`} value={look.color} onChange={(next) => set("color", next)} disabled={readOnly} allowAuto={false} />
                  <ColorPicker id={`${id}-to`} value={look.color2} onChange={(next) => set("color2", next)} disabled={readOnly} allowAuto={false} />
                </div>
              </Field>
              <Choice id={`${id}-direction`} label="Arah" value={look.direction} options={directionOptions} onChange={(next) => set("direction", next)} disabled={readOnly} />
            </>
          ) : null}

          {custom ? (
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor={`${id}-adapt`}>Ikut mode gelap</FieldLabel>
                <FieldDescription>Warna terang digelapkan saat pengunjung memakai mode gelap. Warna teks dipilih otomatis.</FieldDescription>
              </FieldContent>
              <Switch id={`${id}-adapt`} checked={look.adapt} disabled={readOnly} onCheckedChange={(checked) => set("adapt", checked)} />
            </Field>
          ) : null}

          {look.background === "image" ? (
            <>
              <Field>
                <FieldLabel htmlFor={`${id}-image`}>Gambar latar</FieldLabel>
                <ImageInput id={`${id}-image`} value={look.image} onChange={(next) => set("image", next)} readOnly={readOnly} />
              </Field>
              <Choice id={`${id}-focus`} label="Bagian gambar yang dijaga terlihat" value={look.focus} options={focusOptions} onChange={(next) => set("focus", next)} disabled={readOnly} />
              <Choice id={`${id}-overlay`} label="Lapisan di atas gambar" value={look.overlay} options={overlayOptions} onChange={(next) => set("overlay", next)} disabled={readOnly} />
              {look.overlay !== "none" ? (
                <Choice id={`${id}-strength`} label="Tebal lapisan" value={look.strength} options={strengthOptions} onChange={(next) => set("strength", next)} disabled={readOnly} />
              ) : null}
            </>
          ) : null}

          <Choice id={`${id}-pattern`} label="Pola" value={look.pattern} options={patternOptions} onChange={(next) => set("pattern", next)} disabled={readOnly} columns={4} />
          {look.pattern !== "none" ? (
            <>
              <Field>
                <FieldLabel htmlFor={`${id}-pattern-color`}>Warna pola</FieldLabel>
                <ColorPicker id={`${id}-pattern-color`} value={look.patternColor} onChange={(next) => set("patternColor", next)} disabled={readOnly} />
                <FieldDescription>Otomatis: mengikuti warna teks bagian ini.</FieldDescription>
              </Field>
              <SizeSlider
                id={`${id}-pattern-opacity`}
                label="Kekuatan pola"
                value={look.patternOpacity === 100 ? 0 : look.patternOpacity}
                onChange={(next) => set("patternOpacity", next || 100)}
                min={10}
                max={100}
                step={5}
                unit="%"
                fallback={100}
                disabled={readOnly}
              />
            </>
          ) : null}
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Teks</FieldLegend>
        <FieldGroup className="gap-5">
          <SizeSlider
            id={`${id}-title-size`}
            label="Ukuran judul"
            value={look.titleSize}
            onChange={(next) => set("titleSize", next)}
            min={20}
            max={96}
            unit="px"
            fallback={40}
            disabled={readOnly}
            description="Judul besar bagian ini. Di ponsel diperkecil otomatis bila tidak muat."
          />
          <SizeSlider
            id={`${id}-text-size`}
            label="Ukuran teks pengantar"
            value={look.textSize}
            onChange={(next) => set("textSize", next)}
            min={12}
            max={32}
            unit="px"
            fallback={18}
            disabled={readOnly}
            description="Kalimat di bawah judul."
          />
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Lainnya</FieldLegend>
        <FieldGroup className="gap-5">
          <MotionInput
            id={`${id}-reveal`}
            value={{ type: look.reveal, duration: look.revealDuration, delay: look.revealDelay, repeat: look.revealRepeat }}
            onChange={(next) => onChange({ ...look, reveal: next.type, revealDuration: next.duration, revealDelay: next.delay, revealRepeat: next.repeat })}
          />
          <Choice id={`${id}-visibility`} label="Tampil di" value={look.visibility} options={visibilityOptions} onChange={(next) => set("visibility", next)} disabled={readOnly} />
          <Field>
            <FieldLabel htmlFor={`${id}-anchor`}>ID untuk tautan</FieldLabel>
            <InputGroup>
              <InputGroupAddon>#</InputGroupAddon>
              <InputGroupInput
                id={`${id}-anchor`}
                value={look.anchor}
                placeholder="id-tujuan"
                disabled={readOnly}
                // Dirapikan penuh saat dirender (anchorOf); di sini tanda hubung di akhir dibiarkan, supaya bisa diketik.
                onChange={(event) => set("anchor", event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))}
              />
            </InputGroup>
            <FieldDescription>Tombol bertautan #{anchorOf(look.anchor) || "harga"} akan menggulir ke bagian ini.</FieldDescription>
          </Field>
        </FieldGroup>
      </FieldSet>
    </div>
  )
}
