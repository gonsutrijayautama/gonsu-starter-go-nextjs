"use client"

import { lazy, Suspense, useState, type CSSProperties } from "react"
import type { CustomField } from "@puckeditor/core"
import { RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"

// Isian khusus panel editor yang dipakai banyak blok: warna, ukuran, dan
// ikon. Pustaka yang besar (pemilih warna Sketch, ikon lengkap) baru dimuat
// saat isiannya tampil di editor, jadi tidak ikut ke halaman publik.

const Sketch = lazy(() => import("@uiw/react-color-sketch"))
const IconPicker = lazy(() => import("./icon-picker").then((module) => ({ default: module.IconPicker })))

/** Warna siap pilih di pemilih warna: netral, lembut, dan pekat. */
export const presetColors = [
  "#ffffff", "#f4efe6", "#e9dcc4", "#dff3e7", "#dcebfb", "#e9e3fb", "#fbe2e6",
  "#0f172a", "#1f2023", "#1e2a4a", "#1f3b2d", "#4a1d2a", "#f59e0b", "#ec4899",
  "#ef4444", "#22c55e", "#0ea5e9", "#6366f1", "#8b5cf6", "#14b8a6",
]

const hexColor = /^#[0-9a-f]{6}$/i

/** Tema pemilih warna Sketch dari token aplikasi, supaya ikut tema terang/gelap. */
const sketchTheme = {
  "--sketch-background": "var(--popover)",
  "--sketch-box-shadow": "none",
  "--sketch-swatch-border-top": "1px solid var(--border)",
  "--sketch-swatch-box-shadow": "inset 0 0 0 1px var(--border)",
  "--sketch-alpha-box-shadow": "inset 0 0 0 1px var(--border)",
  "--editable-input-box-shadow": "inset 0 0 0 1px var(--input)",
  "--editable-input-color": "var(--foreground)",
  "--editable-input-label-color": "var(--muted-foreground)",
} as CSSProperties

/**
 * Pemilih warna (Sketch dari uiwjs/react-color) di dalam popover. Nilai
 * kosong berarti "Otomatis": warnanya mengikuti tema dan latar bagian.
 */
export function ColorPicker({
  id,
  value,
  onChange,
  disabled,
  allowAuto = true,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  allowAuto?: boolean
}) {
  const [open, setOpen] = useState(false)
  const color = hexColor.test(value) ? value : ""
  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          disabled={disabled}
          render={<Button type="button" variant="outline" className="flex-1 justify-start font-normal" />}
        >
          <span
            aria-hidden="true"
            className="size-4 shrink-0 rounded-full border"
            style={color ? { background: color } : { background: "conic-gradient(from 0deg, var(--muted), var(--foreground), var(--muted))" }}
          />
          <span className="font-mono text-xs uppercase">{color || "Otomatis"}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <Suspense fallback={<Skeleton className="h-72 w-55" />}>
            <Sketch
              color={color || "#6366f1"}
              disableAlpha
              width={220}
              presetColors={presetColors}
              style={sketchTheme}
              onChange={(next) => onChange(next.hex)}
            />
          </Suspense>
        </PopoverContent>
      </Popover>
      {allowAuto && color ? (
        <Button type="button" variant="ghost" size="icon" aria-label="Kembalikan ke otomatis" disabled={disabled} onClick={() => onChange("")}>
          <RotateCcwIcon />
        </Button>
      ) : null}
    </div>
  )
}

/** Ukuran kustom dengan slider. Nilai 0 berarti "Bawaan" (mengikuti blok). */
export function SizeSlider({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  fallback,
  disabled,
  description,
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  unit: string
  /** Posisi slider saat masih "Bawaan". */
  fallback: number
  disabled?: boolean
  description?: string
}) {
  const custom = value > 0
  return (
    <Field>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <span className="flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
          {custom ? `${value}${unit.startsWith("%") ? "" : " "}${unit}` : "Bawaan"}
          {custom ? (
            <Button type="button" variant="ghost" size="icon" aria-label={`${label}: kembali ke bawaan`} disabled={disabled} onClick={() => onChange(0)}>
              <RotateCcwIcon />
            </Button>
          ) : null}
        </span>
      </div>
      <Slider
        id={id}
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={[custom ? value : fallback]}
        disabled={disabled}
        onValueChange={(next) => onChange(Array.isArray(next) ? (next[0] ?? fallback) : (next as number))}
      />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  )
}

/** Isian Puck: warna. "" = otomatis. */
export function colorField(label: string, description?: string): CustomField<string> {
  return {
    type: "custom",
    label,
    metadata: { ai: { kind: "color" } },
    render: ({ id, value, onChange, readOnly }) => (
      <Field>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <ColorPicker id={id} value={value ?? ""} onChange={onChange} disabled={readOnly} />
        {description ? <FieldDescription>{description}</FieldDescription> : null}
      </Field>
    ),
  }
}

/** Isian Puck: ukuran dengan slider. 0 = bawaan. */
export function sizeField(
  label: string,
  range: { min: number; max: number; step?: number; unit: string; fallback: number; description?: string }
): CustomField<number> {
  return {
    type: "custom",
    label,
    metadata: { ai: { kind: "number", min: 0, max: range.max } },
    render: ({ id, value, onChange, readOnly }) => (
      <SizeSlider id={id} label={label} value={typeof value === "number" ? value : 0} onChange={onChange} disabled={readOnly} {...range} />
    ),
  }
}

/** Pemilih ikon di luar isian Puck (panel navbar). Dimuat saat tampil. */
export function IconInput({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  return (
    <Suspense fallback={<Skeleton className="h-8 w-full" />}>
      <IconPicker id={id} value={value} onChange={onChange} />
    </Suspense>
  )
}

/** Isian Puck: ikon dari seluruh ikon lucide. */
export function iconField(label: string): CustomField<string> {
  return {
    type: "custom",
    label,
    metadata: { ai: { kind: "icon" } },
    render: ({ id, value, onChange, readOnly }) => (
      <Field>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <Suspense fallback={<Skeleton className="h-8 w-full" />}>
          <IconPicker id={id} value={value ?? ""} onChange={onChange} disabled={readOnly} />
        </Suspense>
      </Field>
    ),
  }
}
