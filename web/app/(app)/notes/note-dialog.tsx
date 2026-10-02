"use client"

import { useState } from "react"
import { z } from "zod"

import { useApiForm } from "@/hooks/use-api-form"
import { newIdempotencyKey } from "@/lib/api"
import { createNote, updateNote, type Note } from "@/lib/notes"
import { ApiForm } from "@/components/api-form"
import { FormField } from "@/components/form-field"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

// Aturan yang SAMA dengan server (internal/notes): judul 1–200, isi ≤ 10.000.
const noteSchema = z.object({
  title: z.string().trim().min(1, "Judul wajib diisi.").max(200, "Judul maksimal 200 karakter."),
  body: z.string().max(10000, "Isi maksimal 10.000 karakter."),
})

/** Formulir catatan baru (note kosong) atau mengubah catatan yang ada. */
export function NoteDialog({
  note,
  open,
  onOpenChange,
  onSaved,
}: {
  note?: Note
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Formulir dipasang ulang setiap dialog dibuka: isian dan kunci
            idempotensinya baru untuk setiap pengisian. */}
        {open ? <NoteForm note={note} onSaved={onSaved} onCancel={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function NoteForm({ note, onSaved, onCancel }: { note?: Note; onSaved: () => void; onCancel: () => void }) {
  // Satu kunci untuk seluruh pengisian ini: menekan Simpan dua kali, atau
  // mengulang sesudah koneksi putus, tidak membuat catatan ganda.
  const [idempotencyKey] = useState(newIdempotencyKey)
  const { form, isPending, serverErrors } = useApiForm({
    schema: noteSchema,
    // Formulir yang MENGUBAH data diisi nilai lamanya.
    defaultValues: { title: note?.title ?? "", body: note?.body ?? "" },
    submit: (values) => (note ? updateNote(note.id, values) : createNote(values, idempotencyKey)),
    toast: note
      ? { loading: "Menyimpan catatan…", success: "Catatan disimpan" }
      : { loading: "Membuat catatan…", success: "Catatan dibuat" },
    onSuccess: onSaved,
  })

  return (
    <ApiForm form={form} isPending={isPending} submitLabel="Simpan" onCancel={onCancel} Footer={DialogFooter}>
      <DialogHeader>
        <DialogTitle>{note ? "Ubah catatan" : "Catatan baru"}</DialogTitle>
        <DialogDescription>Catatan terlihat oleh semua orang di bisnis ini.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <form.Field name="title">
          {(field) => (
            <FormField field={field} label="Judul" serverError={serverErrors.title}>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                aria-required
                autoFocus
              />
            </FormField>
          )}
        </form.Field>
        <form.Field name="body">
          {(field) => (
            <FormField field={field} label="Isi" serverError={serverErrors.body}>
              <Textarea
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                rows={6}
              />
            </FormField>
          )}
        </form.Field>
      </FieldGroup>
    </ApiForm>
  )
}
