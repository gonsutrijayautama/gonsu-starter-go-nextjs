"use client"

import { useState, type ReactNode } from "react"
import { ArrowDownIcon, ArrowDownRightIcon, ArrowRightIcon, BlendIcon, ChevronDownIcon, GlobeIcon, GripVerticalIcon, LayersIcon, PaletteIcon, PlusIcon, SquareIcon, Trash2Icon } from "lucide-react"
import { cn } from "cn"

import { newLinkId, type ChromeLook, type FooterSettings, type HeaderSettings, type NavItem, type SiteChrome, type SiteLink } from "@/lib/pages"
import { Badge } from "@/components/reui/badge"
import { Sortable, SortableItem, SortableItemHandle } from "@/components/reui/sortable"
import { Button } from "@/components/ui/button"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

import { textOn } from "./appearance"
import { Choice, gradients, Swatch, type Option } from "./appearance-input"
import { ColorPicker, IconInput, SizeSlider } from "./field-kit"
import type { ChromePart } from "./chrome-canvas"

// Panel kanan editor untuk navbar dan kaki situs. Perubahannya berlaku untuk
// semua halaman, jadi panel ini selalu menyebutnya.

const kindOptions: Option<ChromeLook["kind"]>[] = [
  { value: "solid", label: "Solid", icon: SquareIcon },
  { value: "blur", label: "Kaca buram (blur)", short: "Kaca", icon: LayersIcon },
  { value: "gradient", label: "Gradien", icon: BlendIcon },
]

/** Pratinjau warna latar di petak pilihan. */
function tone(className: string) {
  return <span aria-hidden="true" className={cn("size-5 rounded-full border", className)} />
}

const toneOptions: Option<ChromeLook["tone"]>[] = [
  { value: "default", label: "Warna latar halaman", short: "Halaman", preview: tone("bg-background") },
  { value: "muted", label: "Abu-abu lembut", short: "Lembut", preview: tone("bg-muted") },
  { value: "primary", label: "Warna utama", short: "Utama", preview: tone("border-transparent bg-primary") },
  { value: "inverse", label: "Gelap", preview: tone("border-transparent bg-invert") },
  { value: "custom", label: "Pilih sendiri", short: "Pilih", icon: PaletteIcon },
]

const directionOptions: Option<ChromeLook["direction"]>[] = [
  { value: "right", label: "Kiri ke kanan", icon: ArrowRightIcon },
  { value: "diagonal", label: "Miring", icon: ArrowDownRightIcon },
  { value: "down", label: "Atas ke bawah", icon: ArrowDownIcon },
]

/**
 * Latar navbar, kaki situs, atau banner: solid, kaca buram, atau gradien;
 * warna tema atau pilihan sendiri (pemilih warna Sketch).
 */
function LookEditor({ id, value, onChange, borderLabel }: { id: string; value: ChromeLook; onChange: (value: ChromeLook) => void; borderLabel: string }) {
  const set = <K extends keyof ChromeLook>(key: K, next: ChromeLook[K]) => onChange({ ...value, [key]: next })
  const custom = value.kind === "gradient" || value.tone === "custom"
  return (
    <FieldGroup className="gap-5">
      <Choice id={`${id}-kind`} label="Jenis latar" value={value.kind} options={kindOptions} onChange={(next) => set("kind", next)} />
      {value.kind === "gradient" ? (
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
                  picked={gradient.from === value.color.toLowerCase() && gradient.to === value.color2.toLowerCase()}
                  onClick={() => onChange({ ...value, color: gradient.from, color2: gradient.to })}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ColorPicker id={`${id}-from`} value={value.color} onChange={(next) => set("color", next)} allowAuto={false} />
              <ColorPicker id={`${id}-to`} value={value.color2} onChange={(next) => set("color2", next)} allowAuto={false} />
            </div>
          </Field>
          <Choice id={`${id}-direction`} label="Arah" value={value.direction} options={directionOptions} onChange={(next) => set("direction", next)} />
        </>
      ) : (
        <>
          <Choice id={`${id}-tone`} label="Warna" value={value.tone} options={toneOptions} onChange={(next) => set("tone", next)} />
          {value.tone === "custom" ? (
            <Field>
              <FieldLabel htmlFor={`${id}-color`}>Warna latar</FieldLabel>
              <ColorPicker id={`${id}-color`} value={value.color} onChange={(next) => set("color", next)} allowAuto={false} />
            </Field>
          ) : null}
        </>
      )}
      {value.kind === "blur" ? (
        <SizeSlider
          id={`${id}-opacity`}
          label="Kepekatan kaca"
          value={value.opacity}
          onChange={(next) => set("opacity", next || 80)}
          min={30}
          max={100}
          step={5}
          unit="%"
          fallback={80}
          description="Makin kecil, makin tembus pandang isi halaman di belakangnya."
        />
      ) : null}
      {custom ? (
        <Toggle
          id={`${id}-adapt`}
          label="Ikut mode gelap"
          description="Warna terang digelapkan saat pengunjung memakai mode gelap. Warna teks dipilih otomatis."
          checked={value.adapt}
          onChange={(checked) => set("adapt", checked)}
        />
      ) : null}
      <Toggle id={`${id}-border`} label={borderLabel} checked={value.border} onChange={(checked) => set("border", checked)} />
    </FieldGroup>
  )
}

const linkPlaceholder = "/layanan, #harga, atau https://…"

// --- Pemilih varian bergambar mini ---------------------------------------------------------

/** Garis dan kotak kecil untuk gambar mini varian. */
const bar = "h-1 rounded-full bg-muted-foreground/40"
const dot = "size-2 rounded-sm bg-primary"
const pill = "h-2 w-5 rounded-full bg-primary"

const headerVariants: { value: HeaderSettings["variant"]; label: string; sketch: ReactNode }[] = [
  {
    value: "classic",
    label: "Klasik",
    sketch: (
      <div className="flex w-full items-center gap-1.5 border-b border-muted-foreground/30 pb-1.5">
        <span className={dot} />
        <span className={cn(bar, "w-3")} />
        <span className={cn(bar, "w-3")} />
        <span className="flex-1" />
        <span className={pill} />
      </div>
    ),
  },
  {
    value: "centered",
    label: "Menu di tengah",
    sketch: (
      <div className="flex w-full items-center gap-1.5 border-b border-muted-foreground/30 pb-1.5">
        <span className={dot} />
        <span className="flex flex-1 justify-center gap-1">
          <span className={cn(bar, "w-3")} />
          <span className={cn(bar, "w-3")} />
          <span className={cn(bar, "w-3")} />
        </span>
        <span className={pill} />
      </div>
    ),
  },
  {
    value: "stacked",
    label: "Logo di atas",
    sketch: (
      <div className="flex w-full flex-col items-center gap-1 border-b border-muted-foreground/30 pb-1">
        <span className="flex items-center gap-1">
          <span className={dot} />
          <span className={cn(bar, "w-5")} />
        </span>
        <span className="flex gap-1 border-t border-muted-foreground/20 pt-1">
          <span className={cn(bar, "w-3")} />
          <span className={cn(bar, "w-3")} />
          <span className={cn(bar, "w-3")} />
        </span>
      </div>
    ),
  },
  {
    value: "floating",
    label: "Mengambang",
    sketch: (
      <div className="flex w-full items-center gap-1.5 rounded-full border border-muted-foreground/40 px-1.5 py-1">
        <span className={dot} />
        <span className={cn(bar, "w-3")} />
        <span className={cn(bar, "w-3")} />
        <span className="flex-1" />
        <span className={pill} />
      </div>
    ),
  },
  {
    value: "minimal",
    label: "Minimal",
    sketch: (
      <div className="flex w-full items-center gap-1.5 border-b border-muted-foreground/30 pb-1.5">
        <span className={dot} />
        <span className={cn(bar, "w-5")} />
        <span className="flex-1" />
        <span className="flex flex-col gap-0.5">
          <span className={cn(bar, "w-2.5")} />
          <span className={cn(bar, "w-2.5")} />
          <span className={cn(bar, "w-2.5")} />
        </span>
      </div>
    ),
  },
]

const footerVariants: { value: FooterSettings["variant"]; label: string; sketch: ReactNode }[] = [
  {
    value: "columns",
    label: "Berkolom",
    sketch: (
      <div className="flex w-full gap-1.5 border-t border-muted-foreground/30 pt-1.5">
        <span className="flex flex-1 flex-col gap-1">
          <span className={dot} />
          <span className={cn(bar, "w-6")} />
        </span>
        {[0, 1, 2].map((column) => (
          <span key={column} className="flex flex-col gap-1">
            <span className={cn(bar, "w-3 bg-muted-foreground/60")} />
            <span className={cn(bar, "w-3")} />
            <span className={cn(bar, "w-3")} />
          </span>
        ))}
      </div>
    ),
  },
  {
    value: "simple",
    label: "Sederhana",
    sketch: (
      <div className="flex w-full items-center gap-1.5 border-t border-muted-foreground/30 pt-1.5">
        <span className={dot} />
        <span className="flex flex-1 justify-center gap-1">
          <span className={cn(bar, "w-3")} />
          <span className={cn(bar, "w-3")} />
        </span>
        <span className="size-2 rounded-full border border-muted-foreground/50" />
        <span className="size-2 rounded-full border border-muted-foreground/50" />
      </div>
    ),
  },
  {
    value: "centered",
    label: "Di tengah",
    sketch: (
      <div className="flex w-full flex-col items-center gap-1 border-t border-muted-foreground/30 pt-1.5">
        <span className={dot} />
        <span className="flex gap-1">
          <span className={cn(bar, "w-3")} />
          <span className={cn(bar, "w-3")} />
          <span className={cn(bar, "w-3")} />
        </span>
      </div>
    ),
  },
  {
    value: "big",
    label: "Besar",
    sketch: (
      <div className="flex w-full flex-col gap-1 border-t border-muted-foreground/30 pt-1">
        <span className="h-2.5 w-full rounded-sm bg-primary/70" />
        <span className="flex gap-1">
          <span className={cn(bar, "w-4")} />
          <span className={cn(bar, "w-3")} />
          <span className={cn(bar, "w-3")} />
        </span>
        <span className="h-1.5 w-full rounded-sm bg-muted-foreground/25" />
      </div>
    ),
  },
]

function VariantPicker<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: V
  options: { value: V; label: string; sketch: ReactNode }[]
  onChange: (value: V) => void
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const picked = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={picked}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-lg border bg-card p-2.5 text-left text-xs font-medium transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                picked && "border-primary ring-1 ring-primary"
              )}
            >
              <span className="flex h-9 w-full items-center rounded-md bg-muted px-2">{option.sketch}</span>
              {option.label}
            </button>
          )
        })}
      </div>
    </Field>
  )
}

// --- Daftar yang bisa diurutkan (Sortable ReUI) -------------------------------------------

/**
 * Daftar ringkas yang diurutkan dengan diseret. Setiap butir satu baris
 * (pegangan seret, ringkasan); diklik untuk membuka isiannya. Daftar boleh
 * bersarang: setiap tingkat punya Sortable sendiri, jadi sub-tautan diurutkan
 * di dalam tautannya.
 */
function SortableRows<T extends { id: string }>({
  label,
  value,
  onChange,
  create,
  addLabel,
  removeLabel,
  summary,
  editor,
}: {
  label: string
  value: T[]
  onChange: (value: T[]) => void
  create: () => T
  addLabel: string
  removeLabel: string
  summary: (item: T) => { title: string; detail?: string }
  editor: (item: T, update: (item: T) => void) => ReactNode
}) {
  const [open, setOpen] = useState<string[]>([])
  const toggle = (id: string) => setOpen((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]))
  return (
    <div className="flex flex-col gap-1.5">
      {/* Mulai menyeret menutup semua isian: baris yang ringkas lebih mudah diurutkan. */}
      <Sortable
        value={value}
        onValueChange={onChange}
        onDragStart={() => setOpen([])}
        getItemValue={(item) => item.id}
        className="flex flex-col gap-1.5"
        role="list"
        aria-label={label}
      >
        {value.map((item) => {
          const expanded = open.includes(item.id)
          const { title, detail } = summary(item)
          return (
            // Baris bukan tombol: yang bisa difokus dan diseret (juga dengan keyboard) hanya pegangannya.
            <SortableItem key={item.id} value={item.id} role="listitem" tabIndex={-1} className="rounded-lg border bg-card">
              <div className="flex items-center gap-0.5 p-1">
                <SortableItemHandle render={<Button type="button" variant="ghost" size="icon" aria-label={`Seret untuk mengurutkan: ${title}`} />}>
                  <GripVerticalIcon className="text-muted-foreground" />
                </SortableItemHandle>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => toggle(item.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{title}</span>
                    {detail ? <span className="truncate text-xs text-muted-foreground">{detail}</span> : null}
                  </span>
                  <ChevronDownIcon aria-hidden="true" className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
                </button>
              </div>
              {expanded ? (
                <div className="flex flex-col gap-2.5 border-t p-2.5">
                  {editor(item, (next) => onChange(value.map((entry) => (entry.id === item.id ? next : entry))))}
                  <Button
                    type="button"
                    variant="ghost"
                    className="self-start text-destructive hover:text-destructive"
                    onClick={() => onChange(value.filter((entry) => entry.id !== item.id))}
                  >
                    <Trash2Icon data-icon="inline-start" />
                    {removeLabel}
                  </Button>
                </div>
              ) : null}
            </SortableItem>
          )
        })}
      </Sortable>
      <Button
        type="button"
        variant="ghost"
        className="justify-start text-muted-foreground"
        onClick={() => {
          const item = create()
          onChange([...value, item])
          setOpen((current) => [...current, item.id])
        }}
      >
        <PlusIcon data-icon="inline-start" />
        {addLabel}
      </Button>
    </div>
  )
}

function linkSummary(link: SiteLink) {
  return { title: link.label.trim() || "Tautan tanpa nama", detail: link.link.trim() || "Belum ada tujuan" }
}

/** Isian satu tautan: teks dan tujuannya. */
function LinkFields({ value, onChange }: { value: SiteLink; onChange: (value: SiteLink) => void }) {
  return (
    <>
      <Input aria-label="Teks tautan" placeholder="Teks tautan" value={value.label} onChange={(event) => onChange({ ...value, label: event.target.value })} />
      <Input aria-label="Tujuan tautan" placeholder={linkPlaceholder} value={value.link} onChange={(event) => onChange({ ...value, link: event.target.value })} />
    </>
  )
}

function LinkRows({ label, value, onChange, addLabel }: { label: string; value: SiteLink[]; onChange: (value: SiteLink[]) => void; addLabel: string }) {
  return (
    <SortableRows
      label={label}
      value={value}
      onChange={onChange}
      create={() => ({ id: newLinkId(), label: "", link: "" })}
      addLabel={addLabel}
      removeLabel="Hapus tautan"
      summary={linkSummary}
      editor={(item, update) => <LinkFields value={item} onChange={(next) => update({ ...item, ...next })} />}
    />
  )
}

/** Menu navbar: tautan, dengan sub-tautan yang menjadi menu turun. */
function MenuRows({ value, onChange }: { value: NavItem[]; onChange: (value: NavItem[]) => void }) {
  return (
    <SortableRows
      label="Tautan menu"
      value={value}
      onChange={onChange}
      create={() => ({ id: newLinkId(), label: "", link: "", children: [] })}
      addLabel="Tambah tautan menu"
      removeLabel="Hapus tautan"
      summary={(item) => {
        const base = linkSummary(item)
        return item.children.length > 0 ? { ...base, detail: `Menu turun · ${item.children.length} sub-tautan` } : base
      }}
      editor={(item, update) => (
        <>
          <LinkFields value={item} onChange={(next) => update({ ...item, ...next })} />
          <div className="flex flex-col gap-1.5 border-l-2 pl-2.5">
            <p className="text-xs text-muted-foreground">Sub-tautan menjadikannya menu turun.</p>
            <LinkRows label="Sub-tautan" value={item.children} onChange={(children) => update({ ...item, children })} addLabel="Tambah sub-tautan" />
          </div>
        </>
      )}
    />
  )
}

function Toggle({ id, label, description, checked, onChange }: { id: string; label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {description ? <FieldDescription>{description}</FieldDescription> : null}
      </FieldContent>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </Field>
  )
}

function TextField({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </Field>
  )
}

// --- Panel ---------------------------------------------------------------------------------

function HeaderPanel({ value, onChange }: { value: HeaderSettings; onChange: (value: HeaderSettings) => void }) {
  const set = <K extends keyof HeaderSettings>(key: K, next: HeaderSettings[K]) => onChange({ ...value, [key]: next })
  return (
    <div className="flex flex-col gap-8">
      <VariantPicker label="Bentuk navbar" value={value.variant} options={headerVariants} onChange={(next) => set("variant", next)} />

      <FieldSet>
        <FieldLegend>Menu</FieldLegend>
        <FieldGroup className="gap-5">
          <Toggle
            id="header-auto"
            label="Halaman otomatis"
            description="Halaman yang terbit dan bertanda “Tampil di menu” (Pengaturan halaman)."
            checked={value.auto_pages}
            onChange={(checked) => set("auto_pages", checked)}
          />
          <Field>
            <FieldLabel>Tautan tambahan</FieldLabel>
            <MenuRows value={value.links} onChange={(next) => set("links", next)} />
          </Field>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Tombol</FieldLegend>
        <FieldGroup className="gap-5">
          <TextField id="header-cta-label" label="Tombol aksi" value={value.cta.label} placeholder="Kosongkan bila tanpa tombol" onChange={(label) => set("cta", { ...value.cta, label })} />
          {value.cta.label.trim() ? (
            <TextField id="header-cta-link" label="Tautan tombol aksi" value={value.cta.link} placeholder={linkPlaceholder} onChange={(link) => set("cta", { ...value.cta, link })} />
          ) : null}
          <Toggle id="header-login" label="Tombol Masuk" description="Pintu masuk ke aplikasi untuk tim Anda." checked={value.show_login} onChange={(checked) => set("show_login", checked)} />
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Banner</FieldLegend>
        <FieldDescription>Pita pengumuman di atas navbar, mis. promo atau jam buka hari raya.</FieldDescription>
        <FieldGroup className="gap-5">
          <TextField
            id="banner-text"
            label="Teks banner"
            value={value.announcement.text}
            placeholder="Kosongkan bila tanpa banner"
            onChange={(text) => set("announcement", { ...value.announcement, text })}
          />
          {value.announcement.text.trim() ? (
            <>
              <Field>
                <FieldLabel htmlFor="banner-icon">Ikon (boleh kosong)</FieldLabel>
                <IconInput id="banner-icon" value={value.announcement.icon} onChange={(icon) => set("announcement", { ...value.announcement, icon })} />
              </Field>
              <TextField
                id="banner-link"
                label="Tautan"
                value={value.announcement.link}
                placeholder={linkPlaceholder}
                onChange={(link) => set("announcement", { ...value.announcement, link })}
              />
              {value.announcement.link.trim() ? (
                <TextField
                  id="banner-link-label"
                  label="Teks tautan"
                  value={value.announcement.link_label}
                  placeholder="Lihat"
                  onChange={(link_label) => set("announcement", { ...value.announcement, link_label })}
                />
              ) : null}
              <Toggle
                id="banner-moving"
                label="Teks berjalan"
                checked={value.announcement.moving}
                onChange={(moving) => set("announcement", { ...value.announcement, moving })}
              />
              <Toggle
                id="banner-dismissible"
                label="Bisa ditutup pengunjung"
                description="Tetap tertutup sampai teksnya Anda ganti."
                checked={value.announcement.dismissible}
                onChange={(dismissible) => set("announcement", { ...value.announcement, dismissible })}
              />
              <LookEditor
                id="banner-look"
                value={value.announcement.background}
                onChange={(background) => set("announcement", { ...value.announcement, background })}
                borderLabel="Garis bawah banner"
              />
            </>
          ) : null}
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Gaya</FieldLegend>
        <FieldGroup className="gap-5">
          <LookEditor id="header-look" value={value.background} onChange={(next) => set("background", next)} borderLabel="Garis bawah navbar" />
          <Toggle id="header-sticky" label="Menempel saat digulir" checked={value.sticky} onChange={(checked) => set("sticky", checked)} />
        </FieldGroup>
      </FieldSet>
    </div>
  )
}

function FooterPanel({ value, onChange }: { value: FooterSettings; onChange: (value: FooterSettings) => void }) {
  const set = <K extends keyof FooterSettings>(key: K, next: FooterSettings[K]) => onChange({ ...value, [key]: next })
  return (
    <div className="flex flex-col gap-8">
      <VariantPicker label="Bentuk kaki situs" value={value.variant} options={footerVariants} onChange={(next) => set("variant", next)} />

      {value.variant === "big" ? (
        <FieldSet>
          <FieldLegend>Ajakan di atas kaki situs</FieldLegend>
          <FieldGroup className="gap-5">
            <TextField id="footer-cta-title" label="Judul ajakan" value={value.cta.title} placeholder="Kosongkan bila tanpa ajakan" onChange={(title) => set("cta", { ...value.cta, title })} />
            <TextField id="footer-cta-label" label="Teks tombol" value={value.cta.label} onChange={(label) => set("cta", { ...value.cta, label })} />
            <TextField id="footer-cta-link" label="Tautan tombol" value={value.cta.link} placeholder={linkPlaceholder} onChange={(link) => set("cta", { ...value.cta, link })} />
          </FieldGroup>
        </FieldSet>
      ) : null}

      <FieldSet>
        <FieldLegend>Isi otomatis</FieldLegend>
        <FieldDescription>Diambil dari Profil bisnis dan Website, tidak diketik ulang di sini.</FieldDescription>
        <FieldGroup className="gap-5">
          <Toggle id="footer-tagline" label="Tagline" checked={value.show_tagline} onChange={(checked) => set("show_tagline", checked)} />
          <Toggle id="footer-contact" label="Kontak" description="Alamat, telepon, email, dan jam buka." checked={value.show_contact} onChange={(checked) => set("show_contact", checked)} />
          <Toggle id="footer-pages" label="Daftar halaman" checked={value.show_pages} onChange={(checked) => set("show_pages", checked)} />
          <Toggle id="footer-channels" label="Kanal" description="WhatsApp, Instagram, dan lainnya." checked={value.show_channels} onChange={(checked) => set("show_channels", checked)} />
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Kolom tautan</FieldLegend>
        <SortableRows
          label="Kolom tautan"
          value={value.columns}
          onChange={(next) => set("columns", next)}
          create={() => ({ id: newLinkId(), title: "", links: [] })}
          addLabel="Tambah kolom"
          removeLabel="Hapus kolom"
          summary={(column) => ({ title: column.title.trim() || "Kolom tanpa judul", detail: `${column.links.length} tautan` })}
          editor={(column, update) => (
            <>
              <Input aria-label="Judul kolom" placeholder="Judul kolom" value={column.title} onChange={(event) => update({ ...column, title: event.target.value })} />
              <LinkRows label={`Tautan ${column.title || "kolom"}`} value={column.links} onChange={(links) => update({ ...column, links })} addLabel="Tambah tautan" />
            </>
          )}
        />
      </FieldSet>

      <FieldSet>
        <FieldLegend>Lainnya</FieldLegend>
        <FieldGroup className="gap-5">
          <TextField id="footer-copyright" label="Teks hak cipta" value={value.copyright} placeholder="Kosong: © tahun dan nama bisnis" onChange={(next) => set("copyright", next)} />
          <LookEditor id="footer-look" value={value.background} onChange={(next) => set("background", next)} borderLabel="Garis atas kaki situs" />
        </FieldGroup>
      </FieldSet>
    </div>
  )
}

/** Panel navbar atau kaki situs. */
export function ChromePanel({ part, chrome, onChange }: { part: ChromePart; chrome: SiteChrome; onChange: (chrome: SiteChrome) => void }) {
  return (
    <>
      <div className="flex flex-col gap-1 border-b px-4 py-3">
        <p className="text-xs text-muted-foreground">Bagian global</p>
        <div className="flex items-center gap-2">
          <p className="font-semibold">{part === "header" ? "Navbar" : "Kaki situs"}</p>
          <Badge variant="info-light" radius="full">
            <GlobeIcon />
            Semua halaman
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">Perubahan di sini tampil di setiap halaman sesudah Anda menerbitkan.</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {part === "header" ? (
          <HeaderPanel value={chrome.header} onChange={(header) => onChange({ ...chrome, header })} />
        ) : (
          <FooterPanel value={chrome.footer} onChange={(footer) => onChange({ ...chrome, footer })} />
        )}
      </div>
    </>
  )
}
