"use client"

import { useState } from "react"
import { z } from "zod"

import { useApiForm } from "@/hooks/use-api-form"
import { createPage, maxTitle, pathProblem, suggestPath, type Page } from "@/lib/pages"
import { ApiForm } from "@/components/api-form"
import { FormField } from "@/components/form-field"
import { TextInput } from "@/components/form-controls"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"

const createSchema = z.object({
  title: z.string().trim().min(1, "Judul wajib diisi.").max(maxTitle, `Judul maksimal ${maxTitle} karakter.`),
  path: z
    .string()
    .trim()
    .superRefine((path, ctx) => {
      const problem = pathProblem(path)
      if (problem) ctx.addIssue({ code: "custom", message: problem })
    }),
})

/** Membuat halaman baru: judul dulu, alamatnya diusulkan dari judul. */
export function CreatePageDialog({
  open,
  onOpenChange,
  hasHome,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  hasHome: boolean
  onCreated: (page: Page) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? <CreateForm hasHome={hasHome} onCancel={() => onOpenChange(false)} onCreated={onCreated} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function CreateForm({ hasHome, onCancel, onCreated }: { hasHome: boolean; onCancel: () => void; onCreated: (page: Page) => void }) {
  // Alamat mengikuti judul sampai pengelola mengubahnya sendiri.
  const [pathEdited, setPathEdited] = useState(false)
  const { form, isPending, serverErrors } = useApiForm({
    schema: createSchema,
    defaultValues: { title: "", path: hasHome ? "" : "/" },
    submit: (values) => createPage(values),
    toast: { loading: "Membuat halaman…", success: (page) => `Halaman “${page.title}” dibuat` },
    onSuccess: onCreated,
  })

  return (
    <ApiForm form={form} isPending={isPending} submitLabel="Buat dan susun isinya" onCancel={onCancel} Footer={DialogFooter}>
      <DialogHeader>
        <DialogTitle>Buat halaman</DialogTitle>
        <DialogDescription>Mulai dari judul. Isinya disusun sesudah ini, dan belum tampil sampai Anda menerbitkannya.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <form.Field
          name="title"
          listeners={{
            onChange: ({ value }) => {
              if (!pathEdited && form.getFieldValue("path") !== "/") form.setFieldValue("path", suggestPath(value))
            },
          }}
        >
          {(field) => (
            <FormField field={field} label="Judul" description="Misalnya: Layanan, Tentang kami, Harga." serverError={serverErrors.title}>
              <TextInput field={field} aria-required autoFocus />
            </FormField>
          )}
        </form.Field>
        <form.Field name="path">
          {(field) => (
            <FormField
              field={field}
              label="Alamat"
              description={hasHome ? "Diusulkan dari judul; boleh diubah. Huruf kecil, angka, dan tanda hubung." : "Belum ada beranda: alamat / menjadikan halaman ini beranda."}
              serverError={serverErrors.path}
            >
              <TextInput
                field={field}
                className="font-mono"
                placeholder="/layanan"
                onChange={(event) => {
                  setPathEdited(true)
                  field.handleChange(event.target.value)
                }}
              />
            </FormField>
          )}
        </form.Field>
      </FieldGroup>
    </ApiForm>
  )
}
