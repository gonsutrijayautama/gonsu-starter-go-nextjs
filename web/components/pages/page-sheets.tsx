"use client"

import { useEffect, useState } from "react"
import { z } from "zod"

import { useApiForm } from "@/hooks/use-api-form"
import { formatDateTime } from "@/lib/format"
import {
  listVersions,
  maxTitle,
  maxVersions,
  pathProblem,
  restoreVersion,
  updatePageSettings,
  type Page,
  type PageStatus,
  type PageSummary,
  type PageVersion,
} from "@/lib/pages"
import { runWithToast } from "@/lib/toast-action"
import { ApiForm } from "@/components/api-form"
import { ConfirmAction } from "@/components/app-shell/confirm-action"
import { PageLoading } from "@/components/app-shell/page-loading"
import { FormField } from "@/components/form-field"
import { TextArea, TextInput } from "@/components/form-controls"
import { Badge } from "@/components/reui/badge"
import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput } from "@/components/reui/number-field"
import { Button } from "@/components/ui/button"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"

import { ImageInput } from "./image-input"

/** Keadaan terbit halaman, dengan kata yang dipahami pengelola. */
export function PageStatusBadge({ status }: { status: PageStatus }) {
  if (status === "published") return <Badge variant="success-light">Terbit</Badge>
  if (status === "changed") return <Badge variant="warning-light">Ada perubahan belum terbit</Badge>
  return <Badge variant="secondary">Draf</Badge>
}

// --- Pengaturan halaman --------------------------------------------------------

const pathRule = z
  .string()
  .trim()
  .superRefine((path, ctx) => {
    const problem = pathProblem(path)
    if (problem) ctx.addIssue({ code: "custom", message: problem })
  })

const settingsSchema = z.object({
  title: z.string().trim().min(1, "Judul wajib diisi.").max(maxTitle, `Judul maksimal ${maxTitle} karakter.`),
  path: pathRule,
  navigation: z.object({ visible: z.boolean(), position: z.number().int().min(0).max(999) }),
  seo: z.object({
    title: z.string().trim().max(70, "Judul maksimal 70 karakter."),
    description: z.string().trim().max(160, "Deskripsi maksimal 160 karakter."),
    image: z.string().nullable(),
  }),
})

/** Judul, alamat, menu, dan pratinjau tautan satu halaman. */
export function PageSettingsSheet({
  page,
  open,
  onOpenChange,
  onSaved,
}: {
  page: PageSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (page: Page) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {open && page ? <SettingsForm page={page} onCancel={() => onOpenChange(false)} onSaved={onSaved} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function SettingsForm({ page, onCancel, onSaved }: { page: PageSummary; onCancel: () => void; onSaved: (page: Page) => void }) {
  const home = page.path === "/"
  const { form, isPending, serverErrors } = useApiForm({
    schema: settingsSchema,
    defaultValues: { title: page.title, path: page.path, navigation: page.navigation, seo: page.seo },
    submit: (values) => updatePageSettings(page.id, { ...values, version: page.version }),
    toast: { loading: "Menyimpan pengaturan halaman…", success: "Pengaturan halaman disimpan" },
    onSuccess: onSaved,
  })

  return (
    <ApiForm form={form} isPending={isPending} submitLabel="Simpan" onCancel={onCancel} Footer={SheetFooter}>
      <SheetHeader>
        <SheetTitle>Pengaturan halaman</SheetTitle>
        <SheetDescription>Judul, alamat, tempatnya di menu, dan tampilannya saat dibagikan.</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-8 px-4">
        <FieldGroup>
          <form.Field name="title">
            {(field) => (
              <FormField field={field} label="Judul" serverError={serverErrors.title}>
                <TextInput field={field} aria-required />
              </FormField>
            )}
          </form.Field>
          <form.Field name="path">
            {(field) => (
              <FormField
                field={field}
                label="Alamat"
                description={home ? "Beranda selalu di alamat utama, /." : "Huruf kecil, angka, dan tanda hubung. Mengubahnya membuat tautan lama tidak berlaku."}
                serverError={serverErrors.path}
              >
                <TextInput field={field} disabled={home} className="font-mono" />
              </FormField>
            )}
          </form.Field>
        </FieldGroup>

        <FieldSet>
          <FieldLegend>Menu navigasi</FieldLegend>
          <FieldGroup>
            <form.Field name="navigation.visible">
              {(field) => (
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor={field.name}>Tampil di menu</FieldLabel>
                    <FieldDescription>Muncul di menu atas setelah halaman ini terbit.</FieldDescription>
                  </FieldContent>
                  <Switch id={field.name} checked={field.state.value} onCheckedChange={(checked) => field.handleChange(checked)} />
                </Field>
              )}
            </form.Field>
            <form.Field name="navigation.position">
              {(field) => (
                <FormField field={field} label="Urutan di menu" description="Angka kecil tampil lebih dulu.">
                  <NumberField id={field.name} value={field.state.value} min={0} max={999} onValueChange={(value) => field.handleChange(value ?? 0)}>
                    <NumberFieldGroup className="w-36">
                      <NumberFieldDecrement aria-label="Kurangi" />
                      <NumberFieldInput />
                      <NumberFieldIncrement aria-label="Tambah" />
                    </NumberFieldGroup>
                  </NumberField>
                </FormField>
              )}
            </form.Field>
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Saat tautannya dibagikan</FieldLegend>
          <FieldGroup>
            <form.Field name="seo.title">
              {(field) => (
                <FormField field={field} label="Judul" description="Kosong: judul halaman dan nama bisnis." serverError={serverErrors["seo.title"]}>
                  <TextInput field={field} />
                </FormField>
              )}
            </form.Field>
            <form.Field name="seo.description">
              {(field) => (
                <FormField field={field} label="Deskripsi" description="Satu-dua kalimat. Kosong: ringkasan dari Website." serverError={serverErrors["seo.description"]}>
                  <TextArea field={field} rows={2} />
                </FormField>
              )}
            </form.Field>
            <form.Field name="seo.image">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="seo-image">Gambar pratinjau</FieldLabel>
                  <ImageInput id="seo-image" value={field.state.value} onChange={(value) => field.handleChange(value)} />
                  <FieldDescription>Kosong: gambar pratinjau dari Website, atau logo bisnis.</FieldDescription>
                </Field>
              )}
            </form.Field>
          </FieldGroup>
        </FieldSet>
      </div>
    </ApiForm>
  )
}

// --- Riwayat versi -------------------------------------------------------------

/** Versi yang pernah diterbitkan, dan jalan mengembalikan salah satunya ke draf. */
export function VersionsSheet({
  page,
  open,
  onOpenChange,
  onRestored,
  canRestore,
}: {
  page: PageSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRestored: (page: Page) => void
  canRestore: boolean
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Riwayat versi</SheetTitle>
          <SheetDescription>
            {maxVersions} versi terakhir yang pernah diterbitkan. Mengembalikan versi mengganti draf, bukan halaman yang sedang tampil.
          </SheetDescription>
        </SheetHeader>
        {open && page ? (
          <VersionList page={page} canRestore={canRestore} onRestored={(restored) => { onRestored(restored); onOpenChange(false) }} />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function VersionList({ page, canRestore, onRestored }: { page: PageSummary; canRestore: boolean; onRestored: (page: Page) => void }) {
  const [versions, setVersions] = useState<PageVersion[] | null>(null)
  const [restoring, setRestoring] = useState<PageVersion | null>(null)

  useEffect(() => {
    let live = true
    listVersions(page.id).then((list) => live && setVersions(list)).catch(() => live && setVersions([]))
    return () => {
      live = false
    }
  }, [page.id])

  if (!versions) return <PageLoading label="Memuat riwayat…" />
  if (versions.length === 0) {
    return <p className="px-4 text-sm text-muted-foreground">Halaman ini belum pernah diterbitkan.</p>
  }

  const live = page.status === "draft" ? null : versions[0]?.id
  return (
    <div className="px-4 pb-4">
      <ItemGroup className="gap-2">
        {versions.map((version) => (
          <Item key={version.id} variant="outline">
            <ItemContent>
              <ItemTitle>
                Versi {version.number}
                {version.id === live ? <Badge variant="success-light">Sedang tampil</Badge> : null}
              </ItemTitle>
              <ItemDescription>
                {formatDateTime(version.published_at)} · {version.published_by}
              </ItemDescription>
            </ItemContent>
            {canRestore ? (
              <ItemActions>
                <Button type="button" variant="outline" onClick={() => setRestoring(version)}>
                  Jadikan draf
                </Button>
              </ItemActions>
            ) : null}
          </Item>
        ))}
      </ItemGroup>
      <ConfirmAction
        open={restoring !== null}
        onOpenChange={(open) => !open && setRestoring(null)}
        destructive
        title={`Jadikan Versi ${restoring?.number ?? ""} sebagai draf?`}
        description="Isi draf yang sekarang diganti isi versi ini. Halaman yang sedang tampil tidak berubah sampai Anda menerbitkannya lagi."
        confirmLabel="Jadikan draf"
        onConfirm={() => {
          if (!restoring) return
          runWithToast(restoreVersion(page.id, restoring.id), {
            loading: "Mengembalikan versi…",
            success: `Versi ${restoring.number} menjadi draf`,
          })
            .then(onRestored)
            .catch(() => undefined)
        }}
      />
    </div>
  )
}
