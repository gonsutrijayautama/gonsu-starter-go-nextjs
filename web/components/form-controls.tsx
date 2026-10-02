"use client"

import type { ComponentProps, ReactNode } from "react"

import type { ValidatedField } from "@/components/form-field"
import { FramePanel } from "@/components/reui/frame"
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

/** Field TanStack Form berisi teks, sebatas yang dibutuhkan isian di bawah. */
export interface TextField extends ValidatedField {
  state: ValidatedField["state"] & { value: string }
  handleBlur: () => void
  handleChange: (value: string) => void
}

function fieldProps(field: TextField) {
  return {
    // Id sama dengan nama field: label dan galat server memakai nama itu.
    id: field.name,
    name: field.name,
    value: field.state.value,
    onBlur: field.handleBlur,
    "aria-invalid": field.state.meta.isTouched && !field.state.meta.isValid,
  }
}

/** `Input` yang tersambung ke field formulir. Dipakai di dalam `FormField`. */
export function TextInput({ field, ...props }: { field: TextField } & ComponentProps<typeof Input>) {
  return <Input {...fieldProps(field)} onChange={(event) => field.handleChange(event.target.value)} {...props} />
}

/** `Textarea` yang tersambung ke field formulir. Dipakai di dalam `FormField`. */
export function TextArea({ field, ...props }: { field: TextField } & ComponentProps<typeof Textarea>) {
  return <Textarea {...fieldProps(field)} onChange={(event) => field.handleChange(event.target.value)} {...props} />
}

/**
 * Satu bagian formulir satu halaman: panel berjudul di dalam `Frame`.
 * Beberapa bagian = SATU Frame, banyak panel (docs/ui-guide.md).
 */
export function FormSection({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <FramePanel>
      <FieldSet>
        <FieldLegend>{title}</FieldLegend>
        {description ? <p className="-mt-2 text-sm text-muted-foreground">{description}</p> : null}
        <FieldGroup>{children}</FieldGroup>
      </FieldSet>
    </FramePanel>
  )
}

/** Kaki formulir satu halaman: tombol Simpan rata kanan, selebar Frame-nya. */
export function FormFooter({ children }: { children: ReactNode }) {
  return <div className="flex w-full max-w-3xl justify-end gap-2">{children}</div>
}
