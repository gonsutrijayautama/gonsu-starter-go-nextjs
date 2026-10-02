"use client"

import { useState, type ReactNode } from "react"

import { useFileUpload } from "@/hooks/use-file-upload"
import { imageAccept, imageMaxBytes } from "@/lib/business-profile"
import { runWithToast } from "@/lib/toast-action"
import { ConfirmAction } from "@/components/app-shell/confirm-action"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"

export interface ImageFieldProps {
  /** Sebutan gambarnya, huruf kecil: "logo", "foto". Dipakai tombol dan toast. */
  noun: string
  /** Pratinjau gambar yang terpasang, atau penggantinya selama belum ada. */
  preview: ReactNode
  hasImage: boolean
  /** Satu kalimat di bawah tombol: untuk apa gambarnya, dan bentuk yang pas. */
  hint: string
  upload: (file: File) => Promise<unknown>
  remove: () => Promise<unknown>
  /** Apa yang terjadi bila gambarnya dihapus (docs/ui-guide.md §7b). */
  removeDescription: string
  /** Dipanggil sesudah gambar berganti atau terhapus, untuk memuat ulang. */
  onChanged: () => void
}

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

/**
 * Mengganti dan menghapus satu gambar. Berkas langsung diunggah begitu
 * dipilih — gambar bukan bagian formulir, jadi tidak menunggu tombol Simpan,
 * dan isian formulir yang belum disimpan tidak ikut hilang.
 *
 * Jenis dan ukuran berkas diperiksa server (modul media): PNG, JPEG, atau
 * WebP, maksimal 2 MB.
 */
export function ImageField({ noun, preview, hasImage, hint, upload, remove, removeDescription, onChanged }: ImageFieldProps) {
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(false)

  function run(action: Promise<unknown>, text: { loading: string; success: string }) {
    setBusy(true)
    runWithToast(action, text)
      .then(onChanged)
      .catch(() => undefined) // galat sudah menjadi toast
      .finally(() => setBusy(false))
  }

  const [, { openFileDialog, getInputProps, clearFiles }] = useFileUpload({
    accept: imageAccept,
    maxSize: imageMaxBytes,
    onFilesAdded: (added) => {
      const file = added[0]?.file
      // Hook hanya menyimpan pilihan; daftarnya dikosongkan supaya berkas
      // yang sama dapat dipilih lagi sesudah gagal.
      clearFiles()
      if (file instanceof File) {
        run(upload(file), { loading: `Mengunggah ${noun}…`, success: `${capitalize(noun)} diganti` })
      }
    },
    // Pesan hook berbahasa Inggris; yang ditampilkan kalimat sendiri.
    onError: () =>
      toast.add({
        type: "error",
        title: `${capitalize(noun)} tidak bisa dipakai`,
        description: "Pilih gambar PNG, JPEG, atau WebP, maksimal 2 MB.",
      }),
  })

  return (
    <div className="flex flex-wrap items-center gap-4">
      {preview}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={openFileDialog} disabled={busy}>
            {hasImage ? `Ganti ${noun}` : `Unggah ${noun}`}
          </Button>
          {hasImage ? (
            <Button type="button" variant="ghost" onClick={() => setRemoving(true)} disabled={busy}>
              Hapus {noun}
            </Button>
          ) : null}
          <Input {...getInputProps()} className="sr-only" aria-label={`Berkas ${noun}`} tabIndex={-1} />
        </div>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <ConfirmAction
        open={removing}
        onOpenChange={setRemoving}
        destructive
        title={`Hapus ${noun}?`}
        description={removeDescription}
        confirmLabel="Hapus"
        onConfirm={() => run(remove(), { loading: `Menghapus ${noun}…`, success: `${capitalize(noun)} dihapus` })}
      />
    </div>
  )
}
