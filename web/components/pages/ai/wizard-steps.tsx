"use client"

import { useState } from "react"
import { ArrowUpRightIcon, CheckIcon, ClipboardCopyIcon, DownloadIcon } from "lucide-react"
import { cn } from "cn"

import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader, CodeBlockTitle } from "@/components/reui/code-block/code-block"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

// Langkah yang sama di kedua wizard "pakai AI sendiri" (susun dari blok dan
// Desain khusus): penanda langkah, menyalin prompt ke ChatGPT atau Claude,
// dan menempelkan jawabannya kembali.

const chats = [
  { label: "Buka ChatGPT", href: "https://chatgpt.com/" },
  { label: "Buka Claude", href: "https://claude.ai/new" },
]

export function StepBar<S extends string>({ steps, current }: { steps: { value: S; label: string }[]; current: S }) {
  const index = steps.findIndex((step) => step.value === current)
  return (
    <ol className="flex items-center gap-2 text-xs">
      {steps.map((step, position) => (
        <li key={step.value} className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-full border tabular-nums",
              position < index && "border-primary bg-primary text-primary-foreground",
              position === index && "border-primary text-primary",
              position > index && "text-muted-foreground"
            )}
          >
            {position < index ? <CheckIcon className="size-3" /> : position + 1}
          </span>
          <span className={cn("max-sm:hidden", position === index ? "font-medium" : "text-muted-foreground")}>{step.label}</span>
          {position < steps.length - 1 ? <span aria-hidden="true" className="h-px w-4 bg-border" /> : null}
        </li>
      ))}
    </ol>
  )
}

export function PromptStep({
  prompt,
  fileName,
  note,
  id = "ai-prompt",
}: {
  prompt: string
  /** Berkas yang diminta dari AI ("halaman.json", "halaman.html"). */
  fileName: string
  /** Keterangan di bawah prompt, sesudah panjangnya. */
  note?: string
  id?: string
}) {
  const [copied, setCopied] = useState(false)
  const [problem, setProblem] = useState("")

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
    } catch {
      setProblem("Peramban menolak menyalin otomatis. Pilih teks prompt di bawah, lalu salin manual (Ctrl+C).")
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
        <li>Salin prompt di bawah.</li>
        <li>Buka ChatGPT atau Claude, tempel, lalu kirim. Bila kotak chat menolak karena terlalu panjang, unduh prompt-nya lalu lampirkan berkasnya.</li>
        <li>
          AI diminta membuat berkas <span className="font-mono text-xs">{fileName}</span>: unduh berkasnya, atau salin isi blok kodenya (tombol salin di pojok
          blok kode).
        </li>
        <li>Bila jawabannya terpotong, ketik &ldquo;lanjutkan&rdquo; di AI, lalu tempel semua bagiannya berurutan di langkah berikut.</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={copy}>
          {copied ? <CheckIcon data-icon="inline-start" /> : <ClipboardCopyIcon data-icon="inline-start" />}
          {copied ? "Prompt tersalin" : "Salin prompt"}
        </Button>
        {/* Prompt panjang bisa ditolak kotak chat: unggah sebagai berkas lampiran. */}
        <a
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(prompt)}`}
          download="prompt-desain-halaman.txt"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <DownloadIcon data-icon="inline-start" />
          Unduh prompt
        </a>
        {chats.map((chat) => (
          <a key={chat.href} href={chat.href} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline" }))}>
            {chat.label}
            <ArrowUpRightIcon data-icon="inline-end" />
          </a>
        ))}
      </div>
      {problem ? (
        <Alert variant="warning">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-2">
        <CodeBlock id={id} code={prompt} language="markdown" wrap className="max-h-80 overflow-y-auto">
          <CodeBlockHeader>
            <CodeBlockTitle>Prompt</CodeBlockTitle>
            <CodeBlockCopyButton className="ml-auto" labels={{ copy: "Salin", copied: "Tersalin" }} />
          </CodeBlockHeader>
        </CodeBlock>
        <p className="text-sm text-muted-foreground">
          Sekitar {Math.max(1, Math.round(prompt.length / 1000))} ribu karakter{note ? `, ${note}` : ""}.
        </p>
      </div>
    </div>
  )
}

export function PasteStep({
  answer,
  onAnswer,
  onFile,
  problem,
  fileName,
  accept,
  id = "ai",
}: {
  answer: string
  onAnswer: (answer: string) => void
  /** Isi berkas yang diunggah: langsung diperiksa, tanpa menekan tombol lagi. */
  onFile: (text: string) => void
  problem: string
  fileName: string
  accept: string
  /** Awalan id isian: `${id}-answer` dan `${id}-file`. */
  id?: string
}) {
  return (
    <div className="flex flex-col gap-5">
      <Field>
        <FieldLabel htmlFor={`${id}-answer`}>Jawaban AI</FieldLabel>
        <Textarea
          id={`${id}-answer`}
          rows={12}
          value={answer}
          placeholder="Tempel jawaban AI di sini. Bila terpotong, tempel semua bagiannya berurutan."
          className="max-h-80 font-mono text-xs"
          onChange={(event) => onAnswer(event.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-file`}>Atau unggah berkas {fileName} dari AI</FieldLabel>
        <Input
          id={`${id}-file`}
          type="file"
          accept={accept}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) return
            void file.text().then((text) => {
              onAnswer(text)
              onFile(text)
            })
          }}
        />
      </Field>
      {problem ? (
        <Alert variant="destructive">
          <AlertTitle>Belum bisa dipakai</AlertTitle>
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
