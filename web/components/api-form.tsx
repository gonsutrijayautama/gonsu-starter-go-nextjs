"use client"

import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export interface ApiFormProps {
  /** `form` dari `useApiForm`. */
  form: { handleSubmit: () => Promise<void> }
  isPending: boolean
  submitLabel: string
  /** Tombol batal, misalnya untuk menutup dialog. */
  onCancel?: () => void
  /** Pembungkus tombol, misalnya `DialogFooter`. Bawaannya baris rata kanan. */
  Footer?: (props: { children: ReactNode }) => ReactNode
  children: ReactNode
}

function DefaultFooter({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-2">{children}</div>
}

/**
 * Rangka setiap formulir: `<form noValidate>`, isian, lalu tombol kirim yang
 * tertahan selama permintaan berjalan.
 *
 * `noValidate` WAJIB: tanpa itu peramban menghentikan kiriman dengan gelembung
 * bawaannya ("Please fill out this field.") sebelum Zod sempat jalan — pesan
 * berbahasa Inggris yang tidak dapat digayakan. Karena itu juga: jangan pakai
 * atribut `required`; pakai `aria-required` dan skemanya.
 */
export function ApiForm({ form, isPending, submitLabel, onCancel, Footer = DefaultFooter, children }: ApiFormProps) {
  return (
    <form
      noValidate
      className="contents"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      {children}
      <Footer>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Batal
          </Button>
        ) : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? <Spinner data-icon="inline-start" /> : null}
          {submitLabel}
        </Button>
      </Footer>
    </form>
  )
}
