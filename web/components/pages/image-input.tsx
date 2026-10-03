"use client"

import { useState } from "react"
import Image from "next/image"
import { ImageUpIcon, LoaderCircleIcon, RefreshCwIcon, Trash2Icon } from "lucide-react"
import { cn } from "cn"

import { useFileUpload } from "@/hooks/use-file-upload"
import { toast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// PROTOTIPE: gambar diperkecil di peramban lalu disimpan sebagai data URL di
// data halaman. Kelak gambar diunggah ke media (POST /v1/pages/{id}/images)
// dan yang disimpan di data halaman hanya alamat media-nya; server menolak
// data URL.
const maxSide = 1600
const maxBytes = 8 * 1024 * 1024
const accept = "image/png,image/jpeg,image/webp"

async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/webp", 0.82)
}

/**
 * Isian gambar untuk panel blok di editor, pola unggah ReUI (`useFileUpload`):
 * seret gambar ke kotak atau klik untuk memilih; sesudah ada gambar,
 * pratinjaunya dengan tombol Ganti dan Hapus.
 */
export function ImageInput({
  id,
  value,
  onChange,
  readOnly,
}: {
  id: string
  value: string | null
  onChange: (value: string | null) => void
  readOnly?: boolean
}) {
  const [busy, setBusy] = useState(false)

  const [{ isDragging }, { handleDragEnter, handleDragLeave, handleDragOver, handleDrop, openFileDialog, getInputProps, clearFiles }] = useFileUpload({
    accept,
    maxSize: maxBytes,
    onError: () => toast.add({ type: "error", title: "Gambar tidak bisa dipakai", description: "Pilih PNG, JPEG, atau WebP, maksimal 8 MB." }),
    onFilesAdded: (added) => {
      const file = added[0]?.file
      // Daftar berkas hook dikosongkan, supaya berkas yang sama bisa dipilih lagi.
      clearFiles()
      if (!(file instanceof File)) return
      setBusy(true)
      shrink(file)
        .then(onChange)
        .catch(() => toast.add({ type: "error", title: "Gambar tidak bisa dibaca", description: "Coba berkas gambar lain." }))
        .finally(() => setBusy(false))
    },
  })

  const input = <Input {...getInputProps({ id })} className="sr-only" tabIndex={-1} aria-label="Berkas gambar" />

  if (value) {
    return (
      <div className="flex flex-col gap-2">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
          <Image src={value} alt="" fill unoptimized className="object-cover" />
          {busy ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <LoaderCircleIcon aria-hidden="true" className="size-5 animate-spin" />
            </div>
          ) : null}
        </div>
        {readOnly ? null : (
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" disabled={busy} onClick={openFileDialog}>
              <RefreshCwIcon data-icon="inline-start" />
              Ganti
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => onChange(null)}>
              <Trash2Icon data-icon="inline-start" />
              Hapus
            </Button>
          </div>
        )}
        {input}
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={readOnly ? -1 : 0}
      aria-disabled={readOnly || busy}
      data-dragging={isDragging || undefined}
      onClick={readOnly || busy ? undefined : openFileDialog}
      onKeyDown={(event) => {
        if (readOnly || busy || (event.key !== "Enter" && event.key !== " ")) return
        event.preventDefault()
        openFileDialog()
      }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input p-4 text-center transition-colors outline-none",
        "hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-dragging:border-primary data-dragging:bg-accent",
        (readOnly || busy) && "pointer-events-none opacity-60"
      )}
    >
      {input}
      <span className="flex size-10 items-center justify-center rounded-full border bg-background">
        {busy ? <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" /> : <ImageUpIcon aria-hidden="true" className="size-4 text-muted-foreground" />}
      </span>
      <span className="text-sm font-medium">{isDragging ? "Lepaskan gambar di sini" : "Seret gambar ke sini"}</span>
      <span className="text-xs text-muted-foreground">atau klik untuk memilih · PNG, JPEG, WebP, maks. 8 MB</span>
    </div>
  )
}
