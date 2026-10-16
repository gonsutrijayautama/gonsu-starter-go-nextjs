"use client"

import { useState } from "react"
import { ImageUpIcon, LoaderCircleIcon } from "lucide-react"
import { cn } from "cn"

import { useFileUpload } from "@/hooks/use-file-upload"
import { toast } from "@/components/ui/toast"
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

/** Unggah satu gambar, pola unggah ReUI (`useFileUpload`): seret ke kotak atau pilih berkas. */
export function useImageUpload(onImage: (image: string) => void) {
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
        .then(onImage)
        .catch(() => toast.add({ type: "error", title: "Gambar tidak bisa dibaca", description: "Coba berkas gambar lain." }))
        .finally(() => setBusy(false))
    },
  })
  return {
    busy,
    dragging: isDragging,
    open: openFileDialog,
    inputProps: getInputProps,
    zone: { onDragEnter: handleDragEnter, onDragLeave: handleDragLeave, onDragOver: handleDragOver, onDrop: handleDrop },
  }
}

export type ImageUpload = ReturnType<typeof useImageUpload>

/** Isian berkas yang tersembunyi; dibuka lewat `upload.open`. */
export function UploadInput({ upload, id }: { upload: ImageUpload; id?: string }) {
  return <Input {...upload.inputProps({ id })} className="sr-only" tabIndex={-1} aria-label="Berkas gambar" />
}

/** Kotak seret-lepas: seret gambar ke sini atau klik untuk memilih berkas. */
export function UploadZone({ upload, disabled, className }: { upload: ImageUpload; disabled?: boolean; className?: string }) {
  const idle = !disabled && !upload.busy
  return (
    <div
      role="button"
      tabIndex={idle ? 0 : -1}
      aria-disabled={!idle}
      data-dragging={upload.dragging || undefined}
      onClick={idle ? upload.open : undefined}
      onKeyDown={(event) => {
        if (!idle || (event.key !== "Enter" && event.key !== " ")) return
        event.preventDefault()
        upload.open()
      }}
      {...upload.zone}
      className={cn(
        "flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input p-4 text-center transition-colors outline-none",
        "hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-dragging:border-primary data-dragging:bg-accent",
        !idle && "pointer-events-none opacity-60",
        className
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full border bg-background">
        {upload.busy ? <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" /> : <ImageUpIcon aria-hidden="true" className="size-4 text-muted-foreground" />}
      </span>
      <span className="text-sm font-medium">{upload.dragging ? "Lepaskan gambar di sini" : "Seret gambar ke sini"}</span>
      <span className="text-xs text-muted-foreground">atau klik untuk memilih · PNG, JPEG, WebP, maks. 8 MB</span>
    </div>
  )
}
