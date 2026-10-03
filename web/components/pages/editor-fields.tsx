"use client"

import type { ComponentType, ReactNode } from "react"
import type { FieldProps, Overrides, RadioField, SelectField, TextField, TextareaField, NumberField } from "@puckeditor/core"
import { AlignCenterIcon, AlignJustifyIcon, AlignLeftIcon, AlignRightIcon, Columns3Icon, Rows3Icon } from "lucide-react"
import { cn } from "cn"

import { NumberField as NumberInput, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput } from "@/components/reui/number-field"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import { pageConfig } from "./config"
import { OptionPicker, SwitchPicker, type Option } from "./option-picker"

// Isian panel editor dirender dengan komponen aplikasi, bukan isian bawaan
// Puck: label, input, pilihan, dan radio yang sama dengan formulir lain di
// aplikasi. Isian daftar (array) dan teks kaya tetap milik Puck — warnanya,
// radius, dan hurufnya mengikuti token lewat puck-theme.css.
//
// Pilihan (radio dan select) memakai OptionPicker: tombol seperti tab untuk
// pilihan pendek, petak untuk beberapa pilihan, dropdown hanya untuk daftar
// panjang. Ya/tidak menjadi sakelar.

type Props<F> = FieldProps<F, unknown> & { children: ReactNode; name: string }

function Shell({ id, label, children }: { id: string; label?: string; children: ReactNode }) {
  return (
    <Field>
      {label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}
      {children}
    </Field>
  )
}

function TextInput({ field, id, value, onChange, readOnly }: Props<TextField>) {
  return (
    <Shell id={id ?? ""} label={field.label}>
      <Input
        id={id}
        value={typeof value === "string" ? value : ""}
        placeholder={field.placeholder}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
      />
    </Shell>
  )
}

function TextareaInput({ field, id, value, onChange, readOnly }: Props<TextareaField>) {
  return (
    <Shell id={id ?? ""} label={field.label}>
      <Textarea
        id={id}
        rows={3}
        value={typeof value === "string" ? value : ""}
        placeholder={field.placeholder}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
      />
    </Shell>
  )
}

function NumberValue({ field, id, value, onChange, readOnly }: Props<NumberField>) {
  return (
    <Shell id={id ?? ""} label={field.label}>
      <NumberInput
        id={id}
        value={typeof value === "number" ? value : null}
        min={field.min}
        max={field.max}
        step={field.step}
        readOnly={readOnly}
        onValueChange={(next) => onChange(next ?? 0)}
      >
        <NumberFieldGroup>
          <NumberFieldDecrement aria-label="Kurangi" />
          <NumberFieldInput />
          <NumberFieldIncrement aria-label="Tambah" />
        </NumberFieldGroup>
      </NumberInput>
    </Shell>
  )
}

/** Ikon untuk himpunan pilihan yang maknanya jelas: perataan dan arah. */
const alignIcons: Record<string, ComponentType<{ className?: string }>> = {
  left: AlignLeftIcon,
  center: AlignCenterIcon,
  right: AlignRightIcon,
  stretch: AlignJustifyIcon,
}
const orientationIcons: Record<string, ComponentType<{ className?: string }>> = { vertical: Rows3Icon, horizontal: Columns3Icon }

type PuckOption = { label: string; value: string | number | boolean | undefined | null | object }

function optionsOf(options: readonly PuckOption[]): Option<string>[] {
  const list = options.map((option) => ({ value: String(option.value), label: option.label }))
  const values = list.map((option) => option.value)
  // Kiri/tengah/kanan baru berarti perataan bila ada "tengah"; kiri/kanan saja bisa berarti letak gambar.
  const icons = values.includes("center") && values.every((value) => value in alignIcons) ? alignIcons : values.every((value) => value in orientationIcons) ? orientationIcons : null
  return icons ? list.map((option) => ({ ...option, icon: icons[option.value] })) : list
}

/** Ya/tidak murni ("Ya"/"Tampil" lawan "Tidak"): cukup sakelar. */
function switchOf(options: readonly PuckOption[]): { on: PuckOption["value"]; off: PuckOption["value"] } | null {
  if (options.length !== 2) return null
  const on = options.find((option) => option.value === "yes" && (option.label === "Ya" || option.label === "Tampil"))
  const off = options.find((option) => option.value === "no" && option.label === "Tidak")
  return on && off ? { on: on.value, off: off.value } : null
}

function ChoiceInput({ field, id, value, onChange, readOnly }: Props<SelectField | RadioField>) {
  const base = id ?? field.label ?? "pilihan"
  const toggle = switchOf(field.options)
  if (toggle) {
    return <SwitchPicker id={base} label={field.label ?? ""} checked={value === toggle.on} disabled={readOnly} onChange={(checked) => onChange(checked ? toggle.on : toggle.off)} />
  }
  // Nilai dikembalikan dengan tipe aslinya dari daftar pilihan, bukan string.
  const original = (next: string) => field.options.find((option) => String(option.value) === next)?.value ?? next
  return <OptionPicker id={base} label={field.label} value={String(value ?? "")} options={optionsOf(field.options)} disabled={readOnly} onChange={(next) => onChange(original(next))} />
}

/**
 * Label isian milik Puck (daftar, teks kaya, gambar): tipografi yang sama
 * dengan `FieldLabel` aplikasi.
 */
function PuckFieldLabel({
  children,
  label,
  el = "label",
  className,
}: {
  children?: ReactNode
  icon?: ReactNode
  label: string
  el?: "label" | "div"
  readOnly?: boolean
  className?: string
}) {
  const Tag = el
  return (
    <Tag className={cn("flex flex-col gap-2", className)}>
      <span className="text-sm leading-snug font-medium text-foreground">{label}</span>
      {children}
    </Tag>
  )
}

export const editorFieldOverrides: Partial<Overrides<typeof pageConfig>> = {
  fieldTypes: {
    text: TextInput,
    textarea: TextareaInput,
    number: NumberValue,
    select: ChoiceInput,
    radio: ChoiceInput,
  },
  fieldLabel: PuckFieldLabel,
  // Jarak antarisian sama dengan FieldGroup di formulir aplikasi.
  fields: ({ children }) => <div className="flex flex-col gap-5">{children}</div>,
}
