"use client"

import type { ComponentType, ReactElement, ReactNode } from "react"
import { cn } from "cn"

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

// Pilihan di panel editor dengan sesedikit mungkin klik: pilihan pendek
// menjadi deretan tombol (seperti tab), pilihan bergambar menjadi petak ikon,
// ya/tidak menjadi sakelar. Dropdown hanya untuk daftar yang panjang. Label
// lengkap selalu ada di tooltip dan aria-label, jadi tombol boleh ringkas.

export type Option<V extends string> = {
  value: V
  /** Label lengkap: tooltip, aria-label, dan isi dropdown. */
  label: string
  /** Label ringkas di tombol bila `label` terlalu panjang. */
  short?: string
  icon?: ComponentType<{ className?: string }>
  /** Pratinjau kecil (warna latar, gradien) sebagai ganti ikon. */
  preview?: ReactNode
}

/**
 * - `segmented`: satu baris tombol sama lebar, seperti tab.
 * - `icons`: satu baris tombol ikon saja; labelnya di tooltip.
 * - `tiles`: petak berkolom dengan ikon atau pratinjau di atas label.
 * - `select`: dropdown, untuk daftar panjang tanpa ikon.
 */
export type PickerLayout = "segmented" | "icons" | "tiles" | "select"

const textOf = (option: Option<string>) => option.short ?? option.label

/** Tata letak yang paling sedikit kliknya dan tetap muat di panel (±290px). */
export function layoutOf(options: Option<string>[]): PickerLayout {
  const visual = options.every((option) => option.icon || option.preview)
  const longest = Math.max(...options.map((option) => textOf(option).length))
  if (visual && options.every((option) => !option.short) && options.length <= 6 && longest > 9) return "icons"
  // Ikon di samping teks memakan tempat: anggaran huruf satu baris lebih kecil.
  if (options.length <= 4 && longest * options.length <= (visual ? 24 : 32)) return "segmented"
  if (options.length <= 12 && (visual || options.length <= 8)) return "tiles"
  return "select"
}

function columnsOf(options: Option<string>[]): number {
  const longest = Math.max(...options.map((option) => textOf(option).length))
  if (options.length <= 3) return options.length
  if (longest > 14) return 2
  if (options.length === 4 || options.length === 8) return 4
  if (options.length === 5 || options.length === 10) return 5
  return 3
}

const gridCols: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" }

function Tip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

export function OptionPicker<V extends string>({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
  layout,
  columns,
  description,
}: {
  id: string
  label?: string
  value: V
  options: Option<V>[]
  onChange: (value: V) => void
  disabled?: boolean
  layout?: PickerLayout
  columns?: number
  description?: string
}) {
  const mode = layout ?? layoutOf(options)
  const labelId = `${id}-label`

  if (mode === "select") {
    return (
      <Field>
        {label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}
        <Select items={options} value={value} disabled={disabled} onValueChange={(next) => next !== null && onChange(next as V)}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {description ? <FieldDescription>{description}</FieldDescription> : null}
      </Field>
    )
  }

  const tiles = mode === "tiles"
  const count = columns ?? (tiles ? columnsOf(options) : options.length)
  return (
    <Field>
      {label ? <FieldLabel id={labelId}>{label}</FieldLabel> : null}
      <ToggleGroup
        id={id}
        aria-labelledby={label ? labelId : undefined}
        value={[value]}
        disabled={disabled}
        // Mengeklik pilihan yang sedang aktif tidak mengosongkannya.
        onValueChange={(next) => next[0] && onChange(next[0] as V)}
        spacing={tiles ? 1.5 : 0.5}
        className={cn("w-full", tiles ? cn("grid", gridCols[count] ?? "grid-cols-3") : "grid rounded-lg bg-muted p-0.5", !tiles && (gridCols[count] ?? "flex"))}
      >
        {options.map((option) => {
          const Icon = option.icon
          const text = textOf(option)
          const visual = option.preview ?? (Icon ? <Icon className="size-4" /> : null)
          // Tooltip bila tombolnya tidak menampilkan label lengkap.
          const tip = mode === "icons" || text !== option.label
          const item = (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              aria-label={option.label}
              className={cn(
                "min-w-0 text-muted-foreground aria-pressed:text-foreground",
                tiles
                  ? "h-auto flex-col gap-1.5 border border-input px-1 py-2 text-xs font-normal whitespace-normal aria-pressed:border-primary aria-pressed:bg-primary/5 aria-pressed:font-medium"
                  : "h-7 px-1.5 text-xs hover:bg-background/60 aria-pressed:bg-background aria-pressed:shadow-xs"
              )}
            >
              {visual}
              {mode === "icons" ? null : <span className={cn("leading-tight", tiles ? "text-center text-balance" : "truncate")}>{text}</span>}
            </ToggleGroupItem>
          )
          return tip ? (
            <Tip key={option.value} label={option.label}>
              {item}
            </Tip>
          ) : (
            item
          )
        })}
      </ToggleGroup>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  )
}

/** Ya/tidak sebagai sakelar: label di kiri, sakelar di kanan. */
export function SwitchPicker({
  id,
  label,
  checked,
  onChange,
  disabled,
  description,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  description?: string
}) {
  return (
    <Field orientation="horizontal" className="items-start justify-between">
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor={id} className="font-medium">
          {label}
        </FieldLabel>
        {description ? <FieldDescription>{description}</FieldDescription> : null}
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </Field>
  )
}
