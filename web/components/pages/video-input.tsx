"use client"

import { useState } from "react"
import Image from "next/image"
import { Trash2Icon, VideoIcon } from "lucide-react"

import { Badge } from "@/components/reui/badge"
import { Button } from "@/components/ui/button"

import { MediaDialog, type MediaTab } from "./media-dialog"
import { videoSource, youtubePoster } from "./video-source"

/**
 * Isian video untuk panel blok di editor. Dua sumbernya selalu tampil: pustaka
 * video (Pixabay) dan tautan YouTube. Yang disimpan alamat videonya.
 */
export function VideoInput({
  id,
  value,
  onChange,
  readOnly,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
}) {
  const [media, setMedia] = useState<{ open: boolean; tab: MediaTab }>({ open: false, tab: "library" })
  const source = videoSource(value)

  return (
    <div className="flex flex-col gap-2">
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border bg-muted text-muted-foreground">
        {source?.kind === "youtube" ? (
          <Image src={youtubePoster(source.id)} alt="" fill unoptimized className="object-cover" />
        ) : source?.kind === "file" ? (
          // Bingkai pertama videonya sebagai pratinjau.
          <video src={`${source.url}#t=0.1`} muted playsInline preload="metadata" aria-hidden="true" tabIndex={-1} className="size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1.5 px-3 text-center text-xs">
            <VideoIcon aria-hidden="true" className="size-5" />
            {value.trim() ? "Alamat ini bukan video YouTube atau Pixabay." : "Belum ada video."}
          </span>
        )}
        {source ? (
          <Badge variant="secondary" className="absolute bottom-1.5 left-1.5 shadow-sm">
            {source.kind === "youtube" ? "YouTube" : "Pixabay"}
          </Badge>
        ) : null}
        {value.trim() && !readOnly ? (
          <Button type="button" variant="secondary" size="icon-sm" className="absolute top-1.5 right-1.5 shadow-sm" aria-label="Hapus video" onClick={() => onChange("")}>
            <Trash2Icon />
          </Button>
        ) : null}
      </div>
      {readOnly ? null : (
        <div role="group" aria-label={source ? "Ganti video" : "Sumber video"} className="grid grid-cols-2 gap-1.5">
          <Button id={id} type="button" variant="outline" onClick={() => setMedia({ open: true, tab: "library" })}>
            Pustaka
          </Button>
          <Button type="button" variant="outline" onClick={() => setMedia({ open: true, tab: "url" })}>
            YouTube
          </Button>
        </div>
      )}
      <MediaDialog
        kind="video"
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
