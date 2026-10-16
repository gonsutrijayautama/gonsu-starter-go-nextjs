"use client"

import { useState } from "react"
import Image from "next/image"
import { LoaderCircleIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"

import { UploadInput, UploadZone, useImageUpload } from "./image-upload"
import { MediaDialog, type MediaTab } from "./media-dialog"

/**
 * Isian gambar untuk panel blok di editor. Tiga cara mengisinya, selalu
 * tampil: unggah dari perangkat (atau seret ke kotaknya), pilih dari pustaka
 * media, atau pakai alamat gambar.
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
  const upload = useImageUpload(onChange)
  const [media, setMedia] = useState<{ open: boolean; tab: MediaTab }>({ open: false, tab: "library" })
  const blocked = readOnly || upload.busy

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
          <Image src={value} alt="" fill unoptimized className="object-cover" />
          {upload.busy ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <LoaderCircleIcon aria-hidden="true" className="size-5 animate-spin" />
            </div>
          ) : null}
          {readOnly ? null : (
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              className="absolute top-1.5 right-1.5 shadow-sm"
              aria-label="Hapus gambar"
              disabled={upload.busy}
              onClick={() => onChange(null)}
            >
              <Trash2Icon />
            </Button>
          )}
        </div>
      ) : (
        <UploadZone upload={upload} disabled={readOnly} />
      )}
      <UploadInput upload={upload} id={id} />
      {readOnly ? null : (
        <div role="group" aria-label={value ? "Ganti gambar" : "Sumber gambar"} className="grid grid-cols-3 gap-1.5">
          <Button type="button" variant="outline" disabled={blocked} onClick={upload.open}>
            Unggah
          </Button>
          <Button type="button" variant="outline" disabled={blocked} onClick={() => setMedia({ open: true, tab: "library" })}>
            Pustaka
          </Button>
          <Button type="button" variant="outline" disabled={blocked} onClick={() => setMedia({ open: true, tab: "url" })}>
            URL
          </Button>
        </div>
      )}
      <MediaDialog
        open={media.open}
        onOpenChange={(open) => setMedia((previous) => ({ ...previous, open }))}
        tab={media.tab}
        onTabChange={(tab) => setMedia((previous) => ({ ...previous, tab }))}
        current={value}
        onPick={onChange}
      />
    </div>
  )
}
