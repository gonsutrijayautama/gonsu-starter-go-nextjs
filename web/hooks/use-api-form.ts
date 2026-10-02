"use client"

import { useState } from "react"
import { useForm } from "@tanstack/react-form"
import type { z } from "zod"

import { toApiError } from "@/lib/api"
import { runWithToast, toastInvalidForm, type ActionToast } from "@/lib/toast-action"

export interface UseApiFormOptions<TSchema extends z.ZodObject, TResult> {
  /** Aturan isian. Server tetap memvalidasi sendiri; ini hanya umpan balik cepat. */
  schema: TSchema
  /**
   * Nilai awal SELURUH field skema. Formulir yang MENGUBAH data wajib diisi
   * nilai lamanya — kolom kosong yang disimpan tanpa disentuh menghapus data.
   */
  defaultValues: z.input<TSchema>
  /** Panggilan API-nya, dengan nilai yang sudah lolos skema. */
  submit: (values: z.output<TSchema>) => Promise<TResult>
  /** Kalimat toast aksi ini. WAJIB: setiap aksi memberi tahu hasilnya. */
  toast: ActionToast<TResult>
  onSuccess?: (result: TResult) => void
}

/**
 * Formulir tervalidasi: TanStack Form + Zod di peramban, lalu panggilan API
 * dengan toast. Galat per isian dari server (`details`) muncul di bawah
 * kolomnya lewat `serverErrors` — sebagian aturan hanya diketahui server,
 * misalnya nomor yang sudah dipakai.
 */
export function useApiForm<TSchema extends z.ZodObject, TResult>({
  schema,
  defaultValues,
  submit,
  toast,
  onSuccess,
}: UseApiFormOptions<TSchema, TResult>) {
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [isPending, setPending] = useState(false)

  const form = useForm({
    defaultValues,
    // Cast sempit: `validators.onSubmit` bertipe conditional yang tidak dapat
    // diselesaikan TypeScript untuk generic. Skema Zod tidak pernah asinkron.
    validators: { onSubmit: schema as never },
    onSubmitInvalid: toastInvalidForm,
    onSubmit: async ({ value }) => {
      setPending(true)
      setServerErrors({})
      try {
        const result = await runWithToast(submit(schema.parse(value) as z.output<TSchema>), toast)
        onSuccess?.(result)
      } catch (err) {
        const error = toApiError(err)
        setServerErrors(Object.fromEntries(error.details.map((d) => [d.field, d.message])))
      } finally {
        setPending(false)
      }
    },
  })

  return { form, isPending, serverErrors }
}
