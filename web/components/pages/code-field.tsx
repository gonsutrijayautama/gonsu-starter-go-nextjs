"use client"

import { useState } from "react"
import type { CustomField } from "@puckeditor/core"
import { PencilIcon } from "lucide-react"

import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader, CodeBlockTitle } from "@/components/reui/code-block/code-block"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

// Isian kode untuk blok "Bagian khusus": di panel kanan tampil sebagai blok
// kode berwarna (hanya baca), dan disunting di dialog besar supaya HTML dan
// CSS yang panjang nyaman dibaca.

type Language = "html" | "css"

export function CodeInput({
  id,
  label,
  language,
  value,
  onChange,
  readOnly,
}: {
  id: string
  label: string
  language: Language
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
}) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <CodeBlock id={id} code={value} language={language} className="max-h-56 overflow-y-auto text-xs">
        <CodeBlockHeader>
          <CodeBlockTitle>{label}</CodeBlockTitle>
          <CodeBlockCopyButton className="ml-auto" labels={{ copy: "Salin", copied: "Tersalin" }} />
        </CodeBlockHeader>
      </CodeBlock>
      {readOnly ? null : (
        <Button type="button" variant="outline" onClick={() => setEditing(true)}>
          <PencilIcon data-icon="inline-start" />
          Sunting {label}
        </Button>
      )}
      {/* Dipasang ulang setiap dibuka: selalu mulai dari kode yang sedang berlaku. */}
      {editing ? (
        <CodeDialog
          label={label}
          language={language}
          value={value}
          onClose={() => setEditing(false)}
          onApply={(next) => {
            onChange(next)
            setEditing(false)
          }}
        />
      ) : null}
    </div>
  )
}

function CodeDialog({
  label,
  language,
  value,
  onClose,
  onApply,
}: {
  label: string
  language: Language
  value: string
  onClose: () => void
  onApply: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  return (
    // Klik di luar tidak menutup dialog: suntingan yang belum diterapkan tidak hilang karena salah klik.
    <Dialog open onOpenChange={(open) => !open && onClose()} disablePointerDismissal>
      <DialogContent className="flex h-[88svh] flex-col gap-0 p-0 sm:max-w-5xl">
        <DialogHeader className="border-b p-5">
          <DialogTitle>Sunting {label}</DialogTitle>
          <DialogDescription>
            {language === "html"
              ? "Ubah teks dan susunannya di sini. Skrip, formulir, dan gambar dari luar dibuang saat ditampilkan."
              : "Gaya untuk bagian ini saja; tidak memengaruhi bagian lain di halaman."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 p-5">
          <Textarea
            aria-label={label}
            value={draft}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            wrap="off"
            className="h-full min-h-0 flex-1 resize-none field-sizing-fixed overflow-auto font-mono text-xs leading-5 whitespace-pre"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Tab menyisipkan dua spasi, seperti di penyunting kode, alih-alih pindah ke tombol berikutnya.
              if (event.key !== "Tab" || event.shiftKey) return
              event.preventDefault()
              const field = event.currentTarget
              const { selectionStart, selectionEnd } = field
              field.setRangeText("  ", selectionStart, selectionEnd, "end")
              setDraft(field.value)
            }}
          />
        </div>
        <DialogFooter className="mx-0 mb-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="button" onClick={() => onApply(draft)}>
            Terapkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Isian Puck berisi kode: blok kode di panel, dialog besar untuk menyuntingnya. */
export const codeField = (label: string, language: Language): CustomField<string> => ({
  type: "custom",
  label,
  render: ({ id, value, onChange, readOnly }) => (
    <CodeInput id={id} label={label} language={language} value={value ?? ""} onChange={onChange} readOnly={readOnly} />
  ),
})
