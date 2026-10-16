"use client"

import { useEffect, useState } from "react"
import { createUsePuck } from "@puckeditor/core"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronRightIcon,
  CircleSlashIcon,
  FileCodeIcon,
  LayoutTemplateIcon,
  PaletteIcon,
  SparklesIcon,
  SquareIcon,
  Undo2Icon,
  type LucideIcon,
} from "lucide-react"

import { fetchPageAi } from "@/lib/page-ai"
import { contentKey } from "@/lib/pages"
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert"
import { Badge } from "@/components/reui/badge"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import type { AssistantMessage } from "./chat"
import type { AiChat } from "./use-ai-chat"

// Panel AI di sisi kiri editor (tombol "Percakapan baru"-nya ada di kepala
// panel, di editor-screen.tsx), dengan dua cara kerja:
// - Otomatis: chat seperti plugin AI Puck. AI menyusun halaman dari blok yang
//   tersedia, dan hasilnya langsung tampil di kanvas (use-ai-chat.ts). Bila
//   server tidak punya kunci model AI, penyusunnya simulasi (remote.ts).
// - Manual: pengguna memakai ChatGPT atau Claude miliknya sendiri, lalu
//   hasilnya diimpor (custom-designer.tsx dan ai-designer.tsx).

const usePuck = createUsePuck()

type Mode = "auto" | "manual"

export function AiPanel({
  chat,
  onPrompt,
  onImport,
  onBlocks,
}: {
  chat: AiChat
  /** Desain khusus dari awal: kuesioner yang menyusun prompt. */
  onPrompt: () => void
  /** Desain khusus yang sudah jadi: langsung menempel atau mengunggah HTML-nya. */
  onImport: () => void
  /** Wizard blok: AI milik pengguna memilih dari blok siap pakai. */
  onBlocks: () => void
}) {
  const [mode, setMode] = useState<Mode>("auto")
  return (
    <Tabs value={mode} onValueChange={(next) => setMode(next as Mode)} className="flex min-h-0 flex-1 flex-col gap-0">
      <h2 className="sr-only">Asisten halaman</h2>
      <div className="shrink-0 border-b p-2">
        <TabsList className="w-full">
          <TabsTrigger value="auto">Otomatis</TabsTrigger>
          <TabsTrigger value="manual">Manual</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="auto" className="flex min-h-0 flex-1 flex-col">
        <AutoChat chat={chat} />
      </TabsContent>
      <TabsContent value="manual" className="min-h-0 flex-1 overflow-y-auto p-3">
        <ManualOptions onPrompt={onPrompt} onImport={onImport} onBlocks={onBlocks} />
      </TabsContent>
    </Tabs>
  )
}

// --- Manual: AI milik pengguna ------------------------------------------------------------------

function ManualOptions({ onPrompt, onImport, onBlocks }: { onPrompt: () => void; onImport: () => void; onBlocks: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">Pakai ChatGPT atau Claude milik Anda sendiri, lalu masukkan hasilnya ke halaman ini.</p>
      <ManualGroup title="Desain khusus" description="AI merancang tampilannya sendiri dengan HTML. Lebih bebas, tapi teksnya diubah lewat kodenya.">
        <ManualOption icon={PaletteIcon} title="Buat prompt baru" description="Jawab beberapa pertanyaan, lalu salin prompt-nya." onClick={onPrompt} />
        <ManualOption icon={FileCodeIcon} title="Impor yang sudah ada" description="Tempel atau unggah halaman.html dari AI." onClick={onImport} />
      </ManualGroup>
      <ManualGroup title="Blok siap pakai" description="AI memilih dari blok yang tersedia, jadi hasilnya rapi dan bisa diubah lewat isian.">
        <ManualOption icon={LayoutTemplateIcon} title="Susun dari blok" description="Prompt-nya membawa daftar blok." onClick={onBlocks} />
      </ManualGroup>
    </div>
  )
}

function ManualGroup({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ItemGroup className="gap-2">{children}</ItemGroup>
    </section>
  )
}

function ManualOption({ icon: Icon, title, description, onClick }: { icon: LucideIcon; title: string; description: string; onClick: () => void }) {
  return (
    <Item variant="outline" className="cursor-pointer text-left hover:bg-muted" render={<button type="button" onClick={onClick} />}>
      <ItemMedia variant="icon">
        <Icon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription>{description}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <ChevronRightIcon aria-hidden="true" className="size-4 text-muted-foreground" />
      </ItemActions>
    </Item>
  )
}

// --- Otomatis: chat ----------------------------------------------------------------------------

type Example = { label: string; prompt: string }

/** Tawaran untuk halaman yang masih kosong. */
const starters: Example[] = [
  { label: "Beranda", prompt: "Buatkan halaman beranda untuk usaha saya" },
  { label: "Layanan", prompt: "Buatkan halaman layanan" },
  { label: "Daftar harga", prompt: "Buatkan halaman daftar harga" },
  { label: "Tentang kami", prompt: "Buatkan halaman tentang kami" },
  { label: "Kontak", prompt: "Buatkan halaman kontak dan lokasi" },
]

/** Tawaran untuk halaman yang sudah berisi: hanya bagian yang belum ada (`type`). */
const followUps: (Example & { type: string })[] = [
  { label: "Tambah tanya jawab", prompt: "Tambahkan bagian tanya jawab", type: "Faq" },
  { label: "Tambah testimoni", prompt: "Tambahkan testimoni pelanggan", type: "Testimonials" },
  { label: "Tambah galeri", prompt: "Tambahkan galeri foto", type: "Gallery" },
  { label: "Tambah promo", prompt: "Tambahkan bagian promo", type: "Promo" },
]

/** Penyusunnya simulasi: server sudah menjawab bahwa ia tidak punya kunci model AI. Selama belum terjawab, tidak ada yang ditandai. */
function useSimulated(): boolean {
  const [simulated, setSimulated] = useState(false)
  useEffect(() => {
    let active = true
    fetchPageAi().then(
      (status) => active && setSimulated(!status.configured),
      () => active && setSimulated(true)
    )
    return () => {
      active = false
    }
  }, [])
  return simulated
}

function AutoChat({ chat }: { chat: AiChat }) {
  const simulated = useSimulated()
  const data = usePuck((state) => state.appState.data)
  const [draft, setDraft] = useState("")
  const types = new Set((data.content ?? []).map((item) => String(item.type)))
  const examples: Example[] = types.size === 0 ? starters : followUps.filter((example) => !types.has(example.type))
  const last = chat.messages.at(-1)
  // Hanya jawaban terakhir yang bisa diurungkan dari sini, dan hanya selama halaman belum diubah lagi sesudahnya.
  const undoable = !chat.busy && last?.role === "assistant" && last.before !== undefined && last.after === contentKey(data) ? last.id : null

  function submit() {
    if (chat.busy || !draft.trim()) return
    chat.send(draft)
    setDraft("")
  }

  return (
    <>
      {chat.messages.length === 0 ? (
        <Empty className="min-h-0 flex-1 border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SparklesIcon />
            </EmptyMedia>
            <EmptyTitle>Susun halaman lewat percakapan</EmptyTitle>
            <EmptyDescription>Ceritakan halaman yang Anda mau. AI menyusunnya dari blok yang tersedia, langsung di kanvas, dan bisa diurungkan.</EmptyDescription>
          </EmptyHeader>
          {simulated ? (
            <EmptyContent className="text-xs text-muted-foreground">Masih simulasi: bagiannya memakai isi contoh, belum ditulis AI sungguhan.</EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <MessageScrollerProvider autoScroll>
          <MessageScroller className="flex-1">
            <MessageScrollerViewport aria-label="Percakapan dengan asisten halaman" className="p-3">
              <MessageScrollerContent className="gap-4">
                {chat.messages.map((message) => (
                  <MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor={message.role === "user"}>
                    {message.role === "user" ? (
                      <Message align="end">
                        <MessageContent>
                          <Bubble align="end">
                            <BubbleContent>{message.text}</BubbleContent>
                          </Bubble>
                        </MessageContent>
                      </Message>
                    ) : (
                      <Reply message={message} onUndo={undoable === message.id ? () => chat.undo(message.id) : undefined} />
                    )}
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton>
              <ArrowDownIcon />
              <span className="sr-only">Ke pesan terbaru</span>
            </MessageScrollerButton>
          </MessageScroller>
        </MessageScrollerProvider>
      )}

      <div className="flex shrink-0 flex-col gap-2 border-t p-3">
        <InputGroup>
          <InputGroupTextarea
            id="ai-chat-input"
            aria-label="Pesan untuk asisten halaman"
            rows={2}
            value={draft}
            placeholder={types.size === 0 ? "Mau halaman seperti apa?" : "Mau diubah atau ditambah apa?"}
            className="max-h-40"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter mengirim, Shift+Enter baris baru. Enter saat memilih kata di papan ketik IME tidak ikut mengirim.
              if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
              event.preventDefault()
              submit()
            }}
          />
          <InputGroupAddon align="block-end">
            {simulated ? <Badge variant="warning-light">Simulasi</Badge> : null}
            <span className="text-xs font-normal">Enter untuk kirim</span>
            {chat.busy ? (
              <InputGroupButton variant="default" size="icon-sm" className="ml-auto rounded-full" aria-label="Hentikan" onClick={chat.stop}>
                <SquareIcon className="size-3 fill-current" />
              </InputGroupButton>
            ) : (
              <InputGroupButton
                variant="default"
                size="icon-sm"
                className="ml-auto rounded-full aria-disabled:opacity-50"
                aria-label="Kirim"
                aria-disabled={!draft.trim()}
                onClick={submit}
              >
                <ArrowUpIcon />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
        {!chat.busy && examples.length > 0 ? (
          <div role="group" aria-label="Contoh permintaan" className="flex flex-wrap gap-1.5">
            {examples.map((example) => (
              <Button key={example.label} variant="outline" className="rounded-full font-normal" onClick={() => chat.send(example.prompt)}>
                {example.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </>
  )
}

/** Satu jawaban asisten: langkah kerja, kalimatnya, dan yang perlu diketahui sesudahnya. */
function Reply({ message, onUndo }: { message: AssistantMessage; onUndo?: () => void }) {
  const working = message.status === "working"
  return (
    <Message>
      <MessageContent>
        {working && message.steps.length === 0 ? (
          <Marker>
            <MarkerIcon>
              <Spinner aria-label="Sedang dikerjakan" />
            </MarkerIcon>
            <MarkerContent>Memikirkan…</MarkerContent>
          </Marker>
        ) : null}
        {message.steps.map((step) => (
          <Marker key={step.id}>
            <MarkerIcon>
              {step.done ? <CheckIcon className="text-success" /> : working ? <Spinner aria-label="Sedang dikerjakan" /> : <CircleSlashIcon />}
            </MarkerIcon>
            <MarkerContent>{step.label}</MarkerContent>
          </Marker>
        ))}
        {message.text ? (
          <Bubble variant="ghost">
            <BubbleContent>{message.text}</BubbleContent>
          </Bubble>
        ) : null}
        {message.status === "stopped" ? <p className="text-xs text-muted-foreground">Dihentikan. Bagian yang sudah tersusun tetap di halaman.</p> : null}
        {message.status === "failed" ? (
          <Alert variant="destructive">
            <AlertTitle>{message.error ? "Ada masalah dengan jawaban AI" : "Jawabannya terputus"}</AlertTitle>
            <AlertDescription>{message.error ?? "Bagian yang sudah tersusun tetap di halaman. Coba kirim lagi permintaannya."}</AlertDescription>
          </Alert>
        ) : null}
        {message.warnings.length > 0 ? (
          <Alert variant="warning">
            <AlertTitle>Beberapa isian disesuaikan</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {message.warnings.slice(0, 5).map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
                {message.warnings.length > 5 ? <li>dan {message.warnings.length - 5} lainnya.</li> : null}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        {onUndo ? (
          <Button variant="outline" className="self-start" onClick={onUndo}>
            <Undo2Icon data-icon="inline-start" />
            Urungkan perubahan ini
          </Button>
        ) : null}
      </MessageContent>
    </Message>
  )
}
