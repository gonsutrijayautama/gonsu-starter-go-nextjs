"use client"

import { useEffect, useId, useState, type ReactNode } from "react"
import { CheckIcon, ImageIcon, ImagesIcon, ImageUpIcon, LinkIcon, SquarePlayIcon, VideoIcon, type LucideIcon } from "lucide-react"
import { cn } from "cn"

import { toApiError, type ApiError } from "@/lib/api"
import {
  fetchStockMedia,
  generalCategories,
  loadStockPhoto,
  mixedCategory,
  stockCategories,
  stockPages,
  type LibraryCategory,
  type StockPhoto,
  type StockVideo,
} from "@/lib/stock-media"
import { toast } from "@/components/ui/toast"
import { ApiFailure } from "@/components/api-failure"
import { Button } from "@/components/ui/button"
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { UploadInput, UploadZone, useImageUpload } from "./image-upload"
import type { MediaKind } from "./media-picker"
import { youtubeId, youtubePoster } from "./video-source"

// Dialog media. Gambar punya tiga sumber: pustaka foto bebas pakai (Pixabay,
// lewat server), unggah dari perangkat, atau alamat gambar. Video punya dua:
// pustaka video Pixabay atau tautan YouTube. Dipakai isian di panel dan klik
// gambar atau video di kanvas.

export type MediaTab = "library" | "upload" | "url"

const tabsFor: Record<MediaKind, { value: MediaTab; label: string; icon: LucideIcon }[]> = {
  image: [
    { value: "library", label: "Pustaka media", icon: ImagesIcon },
    { value: "upload", label: "Unggah", icon: ImageUpIcon },
    { value: "url", label: "Dari URL", icon: LinkIcon },
  ],
  video: [
    { value: "library", label: "Pustaka video", icon: VideoIcon },
    { value: "url", label: "YouTube", icon: SquarePlayIcon },
  ],
}

const headings: Record<MediaKind, { title: string; description: string }> = {
  image: { title: "Pilih gambar", description: "Ambil dari pustaka media, unggah dari perangkat Anda, atau pakai alamat gambar." },
  video: { title: "Pilih video", description: "Ambil dari pustaka video, atau pakai tautan video YouTube." },
}

export function MediaDialog({
  open,
  onOpenChange,
  kind = "image",
  tab,
  onTabChange,
  current,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind?: MediaKind
  tab: MediaTab
  onTabChange: (tab: MediaTab) => void
  /** Yang sekarang terpasang: alamatnya mengisi tab URL atau YouTube. */
  current?: string | null
  /** Gambar: data URL (pustaka, unggah) atau alamat https. Video: alamat berkas Pixabay atau tautan YouTube. */
  onPick: (value: string) => void
}) {
  const tabs = tabsFor[kind]
  // Tab terakhir bisa berasal dari jenis media lain (video tidak punya "Unggah").
  const active = tabs.some((item) => item.value === tab) ? tab : "library"
  const use = (value: string) => {
    onPick(value)
    onOpenChange(false)
  }
  const close = () => onOpenChange(false)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(88svh,46rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="p-5 pb-3">
          <DialogTitle>{headings[kind].title}</DialogTitle>
          <DialogDescription>{headings[kind].description}</DialogDescription>
        </DialogHeader>
        <Tabs value={active} onValueChange={(next) => onTabChange(next as MediaTab)} className="min-h-0 flex-1 gap-0">
          <div className="border-b px-5 pb-3">
            <TabsList className="w-full sm:w-fit">
              {tabs.map((item) => (
                <TabsTrigger key={item.value} value={item.value} className="sm:px-3">
                  <item.icon aria-hidden="true" />
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="library" className="flex min-h-0 flex-col">
            {kind === "video" ? <VideoLibrary onPick={use} onCancel={close} /> : <PhotoLibrary onPick={use} onCancel={close} />}
          </TabsContent>
          {kind === "image" ? (
            <TabsContent value="upload" className="flex min-h-0 flex-col">
              <UploadPanel onPick={use} />
            </TabsContent>
          ) : null}
          <TabsContent value="url" className="flex min-h-0 flex-col">
            {kind === "video" ? <YoutubePanel current={current ?? null} onPick={use} onCancel={close} /> : <UrlPanel current={current ?? null} onPick={use} onCancel={close} />}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// --- Pustaka ---------------------------------------------------------------------
// Foto dan video bebas pakai dari Pixabay, ditelusuri per kategori. Server
// yang bertanya ke Pixabay (kunci API, cache 24 jam, batas laju). Foto yang
// dipilih disalin ke halaman; video boleh ditautkan langsung.

type CategoryItem = { value: LibraryCategory; label: string }

const categoryItems: CategoryItem[] = [...generalCategories, ...stockCategories]

/**
 * Kategori yang terakhir dibuka, selama halaman ini terbuka: pustaka dibuka
 * lagi di tempat yang sama. Bawaannya campuran semua topik, bukan satu bidang.
 */
let lastCategory: LibraryCategory = mixedCategory

/** Salinan yang urutannya diacak (Fisher–Yates). */
function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

type Listing = {
  photos: StockPhoto[]
  /** Video hanya datang bersama halaman pertama. */
  videos: StockVideo[]
  /** Banyaknya halaman foto yang sudah dimuat. */
  loaded: number
  hasMore: boolean
  configured: boolean
  source: string
}

type LibraryState = {
  category: LibraryCategory
  /** Urutan halaman foto yang dimuat. Kategori acak mulai dari halaman acak, jadi isinya berganti setiap dibuka. */
  pages: number[]
  listing?: Listing
  error?: ApiError
  loading: boolean
}

function begin(category: LibraryCategory, kind: MediaKind): LibraryState {
  const pages = Array.from({ length: stockPages }, (_, index) => index + 1)
  // Video hanya ada di halaman pertama.
  const order = kind === "video" ? [1] : category === mixedCategory ? shuffled(pages) : pages
  return { category, pages: order, loading: true }
}

function useLibrary(kind: MediaKind) {
  const [state, setState] = useState<LibraryState>(() => begin(lastCategory, kind))
  const [attempt, setAttempt] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const { category, pages } = state
  const mixed = category === mixedCategory
  const first = pages[0] ?? 1

  useEffect(() => {
    let live = true
    fetchStockMedia(category, first)
      .then((media) => {
        if (!live) return
        const { photos, videos, has_more } = media.data
        setState((current) => ({
          ...current,
          loading: false,
          listing: {
            // Kategori acak: urutannya juga diacak, supaya tidak selalu foto yang sama di atas.
            photos: mixed ? shuffled(photos) : photos,
            videos: mixed ? shuffled(videos) : videos,
            loaded: 1,
            hasMore: pages.length > 1 && (mixed ? photos.length > 0 : has_more),
            configured: media.configured,
            source: media.source,
          },
        }))
      })
      .catch((err) => live && setState((current) => ({ ...current, loading: false, error: toApiError(err) })))
    return () => {
      live = false
    }
  }, [category, first, pages, mixed, attempt])

  return {
    ...state,
    loadingMore,
    source: state.listing?.source ?? "Pixabay",
    choose(next: LibraryCategory) {
      if (next === category) return
      lastCategory = next
      setState(begin(next, kind))
    },
    retry() {
      setState({ category, pages, loading: true })
      setAttempt((count) => count + 1)
    },
    /** Halaman foto berikutnya, disambung ke yang sudah tampil. */
    more() {
      const page = state.listing ? pages[state.listing.loaded] : undefined
      if (!page || loadingMore) return
      setLoadingMore(true)
      fetchStockMedia(category, page)
        .then((media) =>
          setState((current) => {
            if (current.category !== category || !current.listing) return current
            const photos = mixed ? shuffled(media.data.photos) : media.data.photos
            const loaded = current.listing.loaded + 1
            return {
              ...current,
              listing: {
                ...current.listing,
                photos: [...current.listing.photos, ...photos],
                loaded,
                hasMore: loaded < pages.length && (mixed ? photos.length > 0 : media.data.has_more),
              },
            }
          })
        )
        .catch((err) => toast.add({ type: "error", title: "Foto berikutnya tidak bisa dimuat", description: toApiError(err).message }))
        .finally(() => setLoadingMore(false))
    },
  }
}

type Library = ReturnType<typeof useLibrary>

/** Pencarian kategori dan badan pustaka: memuat, gagal, belum aktif, kosong, atau isinya. */
function LibraryBody({ library, noun, note, empty, children }: { library: Library; noun: string; note: string; empty: boolean; children: ReactNode }) {
  const { category, listing, error, loading, source } = library
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pt-4">
        <Combobox<CategoryItem>
          items={categoryItems}
          value={categoryItems.find((item) => item.value === category) ?? null}
          // Kolom yang dikosongkan untuk mengetik tidak membuang kategori yang sedang tampil.
          onValueChange={(next) => next && library.choose(next.value)}
          isItemEqualToValue={(a, b) => a.value === b.value}
        >
          <ComboboxInput aria-label={`Kategori ${noun}`} placeholder="Cari kategori…" className="w-full sm:w-80" />
          <ComboboxContent>
            <ComboboxEmpty>Kategori tidak ditemukan.</ComboboxEmpty>
            <ComboboxList>
              {(item: CategoryItem) => (
                <ComboboxItem key={item.value} value={item}>
                  {item.label}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <p className="text-xs text-muted-foreground">
          <span className="capitalize">{noun}</span> bebas pakai dari{" "}
          <a href="https://pixabay.com/" target="_blank" rel="noreferrer" className="underline underline-offset-4">
            {source}
          </a>
          . {note}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner aria-label="Sedang memuat" />
            Memuat {noun}…
          </div>
        ) : error ? (
          <ApiFailure error={error} onRetry={library.retry} />
        ) : !listing?.configured ? (
          <Notice title="Pustaka media belum aktif" description="Kunci API Pixabay belum diisi di server ini. Sumber lain di dialog ini tetap bisa dipakai." />
        ) : empty ? (
          <Notice title={`Belum ada ${noun} di kategori ini`} description="Coba kategori lain." />
        ) : (
          children
        )}
      </div>
    </>
  )
}

/** Kaki pustaka: sumber media terpilih (diminta Pixabay) dan tombol pakainya. */
function LibraryFooter({
  picked,
  hint,
  source,
  action,
  disabled,
  onUse,
  onCancel,
}: {
  picked: { label: string; user: string; pageUrl: string } | null
  hint: string
  source: string
  action: string
  disabled: boolean
  onUse: () => void
  onCancel: () => void
}) {
  return (
    <DialogFooter className="mx-0 mb-0 items-center px-5">
      <p className="mr-auto min-w-0 truncate text-xs text-muted-foreground">
        {picked ? (
          <>
            {picked.label} oleh {picked.user} di{" "}
            <a href={picked.pageUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
              {source}
            </a>
          </>
        ) : (
          hint
        )}
      </p>
      <Button type="button" variant="outline" onClick={onCancel}>
        Batal
      </Button>
      <Button type="button" aria-disabled={disabled} className="aria-disabled:opacity-50" onClick={onUse}>
        {action}
      </Button>
    </DialogFooter>
  )
}

const tile =
  "relative block w-full cursor-pointer overflow-hidden rounded-lg border bg-muted bg-cover bg-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:ring-3 aria-pressed:ring-primary"

function Picked() {
  return (
    <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <CheckIcon aria-hidden="true" className="size-3" />
    </span>
  )
}

function PhotoLibrary({ onPick, onCancel }: { onPick: (image: string) => void; onCancel: () => void }) {
  const library = useLibrary("image")
  const [selected, setSelected] = useState<{ category: LibraryCategory; photo: StockPhoto } | null>(null)
  const [busy, setBusy] = useState(false)
  const photos = library.listing?.photos ?? []
  // Pilihan di kategori lain tidak ikut terbawa.
  const photo = selected?.category === library.category ? selected.photo : null

  function pick(target: StockPhoto | null) {
    if (!target || busy) return
    setBusy(true)
    loadStockPhoto(target.id)
      .then(onPick)
      .catch(() => toast.add({ type: "error", title: "Foto tidak bisa diambil", description: "Pixabay sedang tidak menjawab. Coba lagi sebentar lagi, atau pilih foto lain." }))
      .finally(() => setBusy(false))
  }

  return (
    <>
      <LibraryBody library={library} noun="foto" note="Yang dipilih disalin ke halaman Anda." empty={photos.length === 0}>
        <div className="flex flex-col gap-4">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-label={`Foto ${item.tags} oleh ${item.user}`}
                  aria-pressed={photo?.id === item.id}
                  onClick={() => setSelected({ category: library.category, photo: item })}
                  onDoubleClick={() => pick(item)}
                  className={cn(tile, "aspect-4/3")}
                  style={{ backgroundImage: `url("${item.thumbnail_url}")` }}
                >
                  {photo?.id === item.id ? <Picked /> : null}
                </button>
              </li>
            ))}
          </ul>
          {library.listing?.hasMore ? (
            <Button type="button" variant="outline" className="self-center" disabled={library.loadingMore} onClick={library.more}>
              Muat lebih banyak
            </Button>
          ) : null}
        </div>
      </LibraryBody>
      <LibraryFooter
        picked={photo ? { label: "Foto", user: photo.user, pageUrl: photo.page_url } : null}
        hint="Pilih satu foto."
        source={library.source}
        action={busy ? "Mengambil foto…" : "Pakai foto ini"}
        disabled={!photo || busy}
        onUse={() => pick(photo)}
        onCancel={onCancel}
      />
    </>
  )
}

/** Durasi sebagai menit:detik. */
function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

function VideoLibrary({ onPick, onCancel }: { onPick: (url: string) => void; onCancel: () => void }) {
  const library = useLibrary("video")
  const [selected, setSelected] = useState<{ category: LibraryCategory; video: StockVideo } | null>(null)
  const videos = library.listing?.videos ?? []
  const video = selected?.category === library.category ? selected.video : null

  return (
    <>
      <LibraryBody library={library} noun="video" note="Videonya diputar langsung dari Pixabay." empty={videos.length === 0}>
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {videos.map((item) => {
            const chosen = video?.id === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-label={`Video ${item.tags} oleh ${item.user}, ${clock(item.duration)}`}
                  aria-pressed={chosen}
                  onClick={() => setSelected({ category: library.category, video: item })}
                  onDoubleClick={() => onPick(item.url)}
                  className={cn(tile, "aspect-video")}
                  style={item.thumbnail_url ? { backgroundImage: `url("${item.thumbnail_url}")` } : undefined}
                >
                  {/* Yang dipilih diputar di tempat, tanpa suara; tanpa gambar sampul, bingkai pertamanya yang tampil. */}
                  {chosen || !item.thumbnail_url ? (
                    <video
                      src={chosen ? item.url : `${item.url}#t=0.1`}
                      muted
                      loop
                      playsInline
                      autoPlay={chosen}
                      preload="metadata"
                      className="absolute inset-0 size-full object-cover"
                    />
                  ) : null}
                  <span className="absolute bottom-1.5 left-1.5 rounded bg-background/85 px-1.5 py-0.5 text-xs font-medium text-foreground tabular-nums">
                    {clock(item.duration)}
                  </span>
                  {chosen ? <Picked /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      </LibraryBody>
      <LibraryFooter
        picked={video ? { label: "Video", user: video.user, pageUrl: video.page_url } : null}
        hint="Pilih satu video. Yang dipilih diputar di tempat."
        source={library.source}
        action="Pakai video ini"
        disabled={!video}
        onUse={() => video && onPick(video.url)}
        onCancel={onCancel}
      />
    </>
  )
}

function Notice({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="h-full border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ImagesIcon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

// --- Unggah ----------------------------------------------------------------------

function UploadPanel({ onPick }: { onPick: (image: string) => void }) {
  const upload = useImageUpload(onPick)
  return (
    <div className="flex min-h-0 flex-1 flex-col p-5">
      <UploadZone upload={upload} className="aspect-auto flex-1" />
      <UploadInput upload={upload} />
    </div>
  )
}

// --- Alamat ----------------------------------------------------------------------
// Alamatnya yang disimpan, bukan salinan medianya: gambar di situs lain tidak
// bisa disalin dari peramban. Karena itu alamat gambar dicoba dimuat dulu.

/** Sebab alamat ini tidak bisa dipakai sebagai gambar, atau null bila bentuknya benar. */
export function imageUrlProblem(address: string): string | null {
  // Berkas di situs ini sendiri (/media/…).
  if (address.startsWith("/") && !address.startsWith("//")) return null
  let url: URL
  try {
    url = new URL(address)
  } catch {
    return "Alamat ini belum lengkap. Contoh: https://contoh.com/foto.jpg"
  }
  if (url.protocol !== "https:") return "Alamat gambar harus diawali https://."
  // Ketentuan Pixabay: fotonya tidak ditautkan langsung, dan alamatnya hanya berlaku 24 jam.
  if (/(^|\.)pixabay\.com$/i.test(url.hostname)) {
    return "Foto Pixabay tidak boleh ditautkan langsung. Pilih fotonya di tab Pustaka media, supaya disalin ke halaman Anda."
  }
  return null
}

function loads(address: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image.naturalWidth > 0)
    image.onerror = () => resolve(false)
    image.src = address
  })
}

/** Jeda sesudah ketikan terakhir sebelum alamatnya dicoba dimuat. */
const probeDelay = 400

const cssUrl = (address: string) => `url("${address.replace(/["\\]/g, "\\$&")}")`

/** Formulir satu alamat: isian, pesan galat, pratinjau, dan tombol pakainya. */
function AddressForm({
  label,
  placeholder,
  description,
  value,
  onChange,
  message,
  ready,
  action,
  onUse,
  onCancel,
  children,
}: {
  label: string
  placeholder: string
  description: string
  value: string
  onChange: (value: string) => void
  message: string | null
  ready: boolean
  action: string
  onUse: () => void
  onCancel: () => void
  /** Pratinjau. */
  children: ReactNode
}) {
  const id = useId()
  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (ready) onUse()
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        <Field data-invalid={message ? true : undefined}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Input
            id={id}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder={placeholder}
            value={value}
            aria-invalid={message ? true : undefined}
            onChange={(event) => onChange(event.target.value)}
          />
          {message ? <FieldError>{message}</FieldError> : null}
          <FieldDescription>{description}</FieldDescription>
        </Field>
        {children}
      </div>
      <DialogFooter className="mx-0 mb-0 px-5">
        <Button type="button" variant="outline" onClick={onCancel}>
          Batal
        </Button>
        <Button type="submit" aria-disabled={!ready} className="aria-disabled:opacity-50">
          {action}
        </Button>
      </DialogFooter>
    </form>
  )
}

const previewBox = "flex min-h-40 flex-1 items-center justify-center rounded-lg border bg-muted bg-contain bg-center bg-no-repeat text-sm text-muted-foreground"

function UrlPanel({ current, onPick, onCancel }: { current: string | null; onPick: (image: string) => void; onCancel: () => void }) {
  // Data URL (unggahan, foto pustaka) bukan alamat: kolomnya dimulai kosong.
  const [address, setAddress] = useState(current && !current.startsWith("data:") ? current : "")
  const [probe, setProbe] = useState<{ address: string; ok: boolean } | null>(null)
  const trimmed = address.trim()
  const problem = trimmed ? imageUrlProblem(trimmed) : null

  useEffect(() => {
    if (!trimmed || problem) return
    let live = true
    const timer = window.setTimeout(() => {
      void loads(trimmed).then((ok) => live && setProbe({ address: trimmed, ok }))
    }, probeDelay)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [trimmed, problem])

  const checked = probe?.address === trimmed ? probe : null
  const status = !trimmed ? "empty" : problem ? "invalid" : !checked ? "checking" : checked.ok ? "ready" : "broken"
  const message = status === "invalid" ? problem : status === "broken" ? "Alamat ini tidak bisa dibuka sebagai gambar. Periksa lagi alamatnya, atau unggah gambarnya." : null

  return (
    <AddressForm
      label="Alamat gambar"
      placeholder="https://contoh.com/foto.jpg"
      description="Gambarnya tetap berada di alamat itu: bila di sana dihapus atau dipindah, di halaman Anda ikut hilang."
      value={address}
      onChange={setAddress}
      message={message}
      ready={status === "ready"}
      action="Pakai gambar ini"
      onUse={() => onPick(trimmed)}
      onCancel={onCancel}
    >
      <div
        role="img"
        aria-label={status === "ready" ? "Pratinjau gambar dari alamat ini" : "Belum ada pratinjau"}
        className={previewBox}
        style={status === "ready" ? { backgroundImage: cssUrl(trimmed) } : undefined}
      >
        {status === "checking" ? (
          <span className="flex items-center gap-2">
            <Spinner aria-label="Sedang memeriksa" />
            Memeriksa alamat…
          </span>
        ) : status === "ready" ? null : (
          <span className="flex flex-col items-center gap-2">
            <ImageIcon aria-hidden="true" className="size-6" />
            Pratinjau tampil di sini.
          </span>
        )}
      </div>
    </AddressForm>
  )
}

function YoutubePanel({ current, onPick, onCancel }: { current: string | null; onPick: (url: string) => void; onCancel: () => void }) {
  // Video pustaka bukan tautan YouTube: kolomnya dimulai kosong.
  const [address, setAddress] = useState(current && youtubeId(current) ? current : "")
  const trimmed = address.trim()
  const id = youtubeId(trimmed)
  const message = trimmed && !id ? "Ini bukan tautan video YouTube. Contoh: https://www.youtube.com/watch?v=… atau https://youtu.be/…" : null

  return (
    <AddressForm
      label="Tautan YouTube"
      placeholder="https://www.youtube.com/watch?v=…"
      description="Salin tautannya dari tombol Bagikan di YouTube. Videonya diputar dari YouTube, tanpa cookie pelacak sebelum diputar."
      value={address}
      onChange={setAddress}
      message={message}
      ready={id !== null}
      action="Pakai video ini"
      onUse={() => onPick(trimmed)}
      onCancel={onCancel}
    >
      <div
        role="img"
        aria-label={id ? "Sampul video dari tautan ini" : "Belum ada pratinjau"}
        className={previewBox}
        style={id ? { backgroundImage: cssUrl(youtubePoster(id)) } : undefined}
      >
        {id ? null : (
          <span className="flex flex-col items-center gap-2">
            <SquarePlayIcon aria-hidden="true" className="size-6" />
            Sampul videonya tampil di sini.
          </span>
        )}
      </div>
    </AddressForm>
  )
}
