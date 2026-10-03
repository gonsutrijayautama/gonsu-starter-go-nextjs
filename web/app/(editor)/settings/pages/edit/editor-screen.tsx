"use client"

import "@puckeditor/core/puck.css"
import "@/components/pages/puck-theme.css"

import { createContext, Suspense, use, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode, type RefObject } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import { ActionBar, createUsePuck, Puck, type Data } from "@puckeditor/core"
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  EllipsisIcon,
  HistoryIcon,
  LockIcon,
  MonitorIcon,
  MousePointerClickIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  PanelTopIcon,
  PointerIcon,
  Redo2Icon,
  Settings2Icon,
  SmartphoneIcon,
  SparklesIcon,
  Undo2Icon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react"
import { cn } from "cn"

import { toApiError, type ApiError } from "@/lib/api"
import {
  contentKey,
  getChrome,
  getPage,
  publicHref,
  publicNavigation,
  publishChrome,
  publishPage,
  saveChromeDraft,
  saveDraft,
  unpublishPage,
  type NavigationLink,
  type Page,
  type SiteChrome,
  type SiteChromeState,
} from "@/lib/pages"
import { Permission } from "@/lib/permissions"
import { portalLinks } from "@/lib/portal"
import { emptySite, fetchSite, type Site } from "@/lib/site"
import { runWithToast } from "@/lib/toast-action"
import { toast } from "@/components/ui/toast"
import { ApiFailure } from "@/components/api-failure"
import { ConfirmAction } from "@/components/app-shell/confirm-action"
import { PageLoading } from "@/components/app-shell/page-loading"
import { ThemeToggle } from "@/components/app-shell/theme-toggle"
import { BlockDrawer } from "@/components/pages/block-drawer"
import type { Appearance } from "@/components/pages/appearance"
import { ChromeCanvasContext, type ChromeCanvas, type ChromePart } from "@/components/pages/chrome-canvas"
import { ChromePanel } from "@/components/pages/chrome-panel"
import { InCanvasContext } from "@/components/pages/stat-number"
import { AppearanceInput } from "@/components/pages/appearance-input"
import { editorDictionary, pageConfig, sectionBlocks } from "@/components/pages/config"
import { editorFieldOverrides } from "@/components/pages/editor-fields"
import { migrateContent } from "@/components/pages/migrate"
import { AiDesigner } from "@/components/pages/ai/ai-designer"
import { PageSettingsSheet, PageStatusBadge, VersionsSheet } from "@/components/pages/page-sheets"
import { useCan, usePortal, useSession } from "@/components/session-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const usePuck = createUsePuck<typeof pageConfig>()

/** Lebar halaman yang dipratinjau, dalam piksel CSS halaman itu sendiri. */
const viewportWidths = { mobile: 390, desktop: 1280 } as const
type Viewport = keyof typeof viewportWidths

/** "fit" mengikuti lebar kanvas; angka adalah skala tetap (0.5 = 50%). */
type Zoom = "fit" | number
const zoomSteps = [0.25, 0.5, 0.75]

/** Skala kanvas yang sedang berlaku, untuk bilah aksi blok di dalamnya. */
const CanvasZoomContext = createContext(1)

type Editing = {
  page: Page
  /** Kunci isi draf yang terakhir tersimpan, untuk tahu ada-tidaknya perubahan. */
  saved: string
  busy: boolean
  site: Site
  navigation: NavigationLink[]
  /** Navbar dan kaki situs (draf), bersama untuk semua halaman. */
  chrome: SiteChrome
  setChrome: (chrome: SiteChrome) => void
  /** Draf navbar/kaki situs belum disimpan. */
  chromeDirty: boolean
  /** Draf navbar/kaki situs berbeda dengan yang terbit. */
  chromePending: boolean
  /** Navbar atau kaki situs yang sedang disunting di panel kanan. */
  part: ChromePart | null
  setPart: (part: ChromePart | null) => void
  save: (data: Data) => void
  publish: (data: Data) => void
  unpublish: () => void
  openSettings: () => void
  openVersions: () => void
}

const EditingContext = createContext<Editing | null>(null)

/** PROTOTIPE editor halaman (Puck). Halaman dipilih lewat ?id=. */
export function EditorScreen() {
  return (
    <Suspense fallback={<PageLoading label="Membuka editor…" className="min-h-svh" />}>
      <EditorLoader />
    </Suspense>
  )
}

function EditorLoader() {
  const id = useSearchParams().get("id") ?? ""
  const can = useCan()
  const portal = usePortal()
  // ?bagian=navbar atau ?bagian=kaki membuka editor dengan bagian itu terpilih.
  const part = { navbar: "header", kaki: "footer" }[useSearchParams().get("bagian") ?? ""] as ChromePart | undefined
  const [page, setPage] = useState<(Page & { enabled: boolean }) | null>(null)
  const [chrome, setChrome] = useState<SiteChromeState | null>(null)
  const [navigation, setNavigation] = useState<NavigationLink[]>([])
  const [error, setError] = useState<ApiError | null>(null)
  const [site, setSite] = useState<Site>(emptySite)

  useEffect(() => {
    let live = true
    Promise.all([getPage(id), getChrome()])
      .then(([loadedPage, loadedChrome]) => {
        if (!live) return
        // Data lama dibaca dengan blok yang sekarang (blok kembar yang digabung, isian baru).
        setPage({ ...loadedPage, draft: migrateContent(loadedPage.draft) })
        setChrome(loadedChrome)
        setNavigation(publicNavigation())
      })
      .catch((err) => live && setError(toApiError(err)))
    fetchSite()
      .then((loaded) => live && setSite(loaded))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [id])

  if (!can(Permission.SettingsWebsiteManage)) {
    return <Blocked title="Role Anda belum bisa menyusun halaman" description="Minta administrator mengubah role Anda." />
  }
  if (error) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-6">
        <ApiFailure error={error} />
        <BackLink />
      </div>
    )
  }
  if (!page || !chrome) return <PageLoading label="Membuka editor…" className="min-h-svh" />
  if (!page.enabled) {
    return (
      <Blocked
        title="Paket Anda belum termasuk penyusun halaman"
        description="Halaman yang sudah terbit tetap tampil, tapi isinya tidak bisa diubah."
        action={
          portal ? (
            <a href={portalLinks.plans} className={cn(buttonVariants())}>
              Lihat paket
            </a>
          ) : null
        }
      />
    )
  }
  return <Editor initial={page} initialChrome={chrome} initialPart={part ?? null} site={site} navigation={navigation} />
}

const chromeKey = (chrome: SiteChrome) => JSON.stringify(chrome)

function Editor({
  initial,
  initialChrome,
  initialPart,
  site,
  navigation,
}: {
  initial: Page
  initialChrome: SiteChromeState
  initialPart: ChromePart | null
  site: Site
  navigation: NavigationLink[]
}) {
  const me = useSession()
  const [page, setPage] = useState(initial)
  const [saved, setSaved] = useState(() => contentKey(initial.draft))
  const [chrome, setChrome] = useState(initialChrome.draft)
  const [chromeVersion, setChromeVersion] = useState(initialChrome.version)
  const [chromeSaved, setChromeSaved] = useState(() => chromeKey(initialChrome.draft))
  const [chromeLive, setChromeLive] = useState(() => chromeKey(initialChrome.published))
  const [part, setPart] = useState<ChromePart | null>(initialPart)
  const chromeDirty = chromeKey(chrome) !== chromeSaved
  const chromePending = chromeKey(chrome) !== chromeLive
  // Puck dipasang ulang bila draf diganti dari luar editor (versi dikembalikan).
  const [mount, setMount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [unpublishing, setUnpublishing] = useState(false)

  // Perubahan yang belum disimpan tidak hilang diam-diam saat tab ditutup.
  const [dirty, setDirty] = useState(false)
  const unsaved = dirty || chromeDirty
  useEffect(() => {
    if (!unsaved) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [unsaved])

  function accept(result: Page) {
    // Versi yang dikembalikan bisa berisi blok lama.
    const next = { ...result, draft: migrateContent(result.draft) }
    setPage(next)
    setSaved(contentKey(next.draft))
    setDirty(false)
  }

  async function persist(data: Data): Promise<Page> {
    if (contentKey(data) === saved) return page
    return saveDraft(page.id, { draft: data, version: page.version })
  }

  function acceptChrome(state: SiteChromeState) {
    setChromeVersion(state.version)
    setChromeSaved(chromeKey(state.draft))
    setChromeLive(chromeKey(state.published))
  }

  /** Navbar dan kaki situs disimpan bersama draf halaman. */
  async function persistChrome(): Promise<SiteChromeState> {
    if (!chromeDirty) return { draft: chrome, published: JSON.parse(chromeLive) as SiteChrome, version: chromeVersion }
    const next = await saveChromeDraft({ draft: chrome, version: chromeVersion })
    acceptChrome(next)
    return next
  }

  /** Terbitkan halaman sekaligus navbar dan kaki situs bila drafnya berbeda dari yang terbit. */
  async function publishAll(data: Data): Promise<Page> {
    const stored = await persist(data)
    const state = await persistChrome()
    if (chromeKey(state.draft) !== chromeKey(state.published)) acceptChrome(await publishChrome({ version: state.version }))
    return publishPage(stored.id, { version: stored.version, by: me.name || me.email })
  }

  function run(action: Promise<Page>, text: { loading: string; success: string }) {
    setBusy(true)
    runWithToast(action, text)
      .then(accept)
      .catch(() => undefined)
      .finally(() => setBusy(false))
  }

  const editing: Editing = {
    page,
    saved,
    busy,
    site,
    navigation,
    chrome,
    setChrome,
    chromeDirty,
    chromePending,
    part,
    setPart,
    save: (data) =>
      run(
        persist(data).then(async (stored) => {
          await persistChrome()
          return stored
        }),
        { loading: "Menyimpan draf…", success: "Draf disimpan" }
      ),
    publish: (data) => run(publishAll(data), { loading: "Menerbitkan halaman…", success: `“${page.title}” terbit` }),
    unpublish: () => setUnpublishing(true),
    openSettings: () => setSettingsOpen(true),
    openVersions: () => setVersionsOpen(true),
  }

  return (
    <EditingContext value={editing}>
      <Puck
        key={mount}
        config={pageConfig}
        data={page.draft}
        dictionary={editorDictionary}
        metadata={{ site, linkFor: () => "#" }}
        onChange={(data) => setDirty(contentKey(data) !== saved)}
        // Memilih blok menutup panel navbar/kaki situs.
        onAction={(action) => {
          if ((action.type === "setUi" && typeof action.ui === "object" && action.ui.itemSelector) || action.type === "insert") setPart(null)
        }}
        overrides={{ ...editorFieldOverrides, iframe: CanvasFrame, actionBar: CanvasActionBar }}
      >
        <EditorShell />
      </Puck>
      <PageSettingsSheet
        page={page}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaved={(next) => {
          // Pengaturan tidak menyentuh isi: draf yang sedang disunting tetap.
          setPage((prev) => ({ ...next, draft: prev.draft }))
          setSettingsOpen(false)
        }}
      />
      <VersionsSheet
        page={page}
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        canRestore
        onRestored={(next) => {
          accept(next)
          setMount((m) => m + 1)
        }}
      />
      <ConfirmAction
        open={unpublishing}
        onOpenChange={setUnpublishing}
        destructive
        title={`Batalkan terbit “${page.title}”?`}
        description="Halaman ini hilang dari situs dan dari menu. Drafnya tetap tersimpan dan bisa diterbitkan lagi."
        confirmLabel="Batalkan terbit"
        onConfirm={() => run(unpublishPage(page.id), { loading: "Membatalkan terbit…", success: `“${page.title}” tidak lagi tampil` })}
      />
    </EditingContext>
  )
}

/**
 * Kerangka editor dari komponen aplikasi. Puck hanya mengisi isinya: daftar
 * blok dan komponen (`Drawer` di `BlockDrawer`), susunan (`Puck.Outline`),
 * kanvas (`Puck.Preview`), dan isian blok terpilih (`Puck.Fields`).
 */
function EditorShell() {
  // Halaman dirender selebar layar aslinya (ponsel 390 px, komputer 1280 px)
  // lalu diperkecil supaya muat, seperti kanvas bawaan Puck. Tanpa itu
  // pratinjau "komputer" hanya selebar ruang di tengah editor, dan tata letak
  // lebarnya tidak pernah terlihat.
  const stage = useRef<HTMLDivElement>(null)
  const size = useElementSize(stage)
  const [viewport, setViewport] = useState<Viewport>("desktop")
  const [zoom, setZoom] = useState<Zoom>("fit")
  const width = viewportWidths[viewport]
  // Dibulatkan ke bawah supaya halaman tidak lebih lebar satu piksel dari kanvas.
  const fit = size.width ? Math.min(Math.floor((size.width / width) * 1000) / 1000, 1) : 1
  const scale = zoom === "fit" ? fit : Math.min(zoom, fit)
  const [panels, setPanels] = useState(readPanels)
  const togglePanel = (side: keyof Panels) => {
    const next = { ...panels, [side]: !panels[side] }
    setPanels(next)
    storePanels(next)
  }

  return (
    <TooltipProvider delay={300}>
      <div className="flex h-svh flex-col bg-sidebar text-foreground">
        <TopBar panels={panels} onTogglePanel={togglePanel}>
          <PreviewControls
            viewport={viewport}
            zoom={zoom}
            fit={fit}
            onViewport={(next) => {
              setViewport(next)
              setZoom("fit")
            }}
            onZoom={setZoom}
          />
        </TopBar>
        <div className="flex min-h-0 flex-1">
          <aside aria-label="Blok" className={cn("hidden w-64 shrink-0 flex-col border-r", panels.left && "md:flex")}>
            <Tabs defaultValue="blocks" className="flex min-h-0 flex-1 flex-col gap-0">
              <div className="border-b p-3">
                <TabsList className="w-full">
                  <TabsTrigger value="blocks">Blok</TabsTrigger>
                  <TabsTrigger value="components">Komponen</TabsTrigger>
                  <TabsTrigger value="outline">Susunan</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="blocks" className="min-h-0 flex-1 overflow-y-auto p-3">
                <BlockDrawer tab="blocks" />
              </TabsContent>
              <TabsContent value="components" className="min-h-0 flex-1 overflow-y-auto p-3">
                <BlockDrawer tab="components" />
              </TabsContent>
              <TabsContent value="outline" className="min-h-0 flex-1 overflow-y-auto p-3">
                <Puck.Outline />
              </TabsContent>
            </Tabs>
          </aside>

          <main className="flex min-w-0 flex-1 flex-col bg-muted/40 p-4">
            <div ref={stage} className="relative min-h-0 flex-1 overflow-hidden">
              <div
                className="absolute top-0 left-1/2 overflow-hidden border bg-background shadow-sm transition-[width,transform] duration-150 ease-out motion-reduce:transition-none"
                style={{
                  width,
                  height: size.height ? size.height / scale : "100%",
                  transform: `translateX(-50%) scale(${scale})`,
                  transformOrigin: "top center",
                }}
              >
                <CanvasZoomContext value={scale}>
                  <ChromeCanvasProvider>
                    <Puck.Preview />
                  </ChromeCanvasProvider>
                </CanvasZoomContext>
              </div>
            </div>
          </main>

          <aside aria-label="Isian blok" className={cn("hidden w-80 shrink-0 flex-col border-l", panels.right && "lg:flex")}>
            <FieldsPanel />
          </aside>
        </div>
      </div>
    </TooltipProvider>
  )
}

type Panels = { left: boolean; right: boolean }

const panelsKey = "editor-halaman.panel"

/** Panel yang terbuka diingat per peramban; tanpa penyimpanan peramban keduanya terbuka. */
function readPanels(): Panels {
  try {
    const stored = JSON.parse(window.localStorage.getItem(panelsKey) ?? "null") as Partial<Panels> | null
    return { left: stored?.left !== false, right: stored?.right !== false }
  } catch {
    return { left: true, right: true }
  }
}

function storePanels(panels: Panels) {
  try {
    window.localStorage.setItem(panelsKey, JSON.stringify(panels))
  } catch {
    // Tidak tersimpan: hanya berlaku sampai editor ditutup.
  }
}

/** Tombol dengan keterangan saat disorot. `children` satu elemen yang menerima ref (Button, Link). */
function Tip({ label, children, side = "bottom" }: { label: string; children: ReactElement; side?: "top" | "bottom" }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}

/** Satu baris: kembali dan judul di kiri, pratinjau di tengah (`children`), aksi di kanan. */
function TopBar({ children, panels, onTogglePanel }: { children: ReactNode; panels: Panels; onTogglePanel: (side: keyof Panels) => void }) {
  const editing = use(EditingContext)
  const data = usePuck((state) => state.appState.data)
  const history = usePuck((state) => state.history)
  const dispatch = usePuck((state) => state.dispatch)
  // Wizard AI dipasang saat pertama dibuka (profil bisnis sudah termuat), lalu tetap terpasang supaya isiannya tidak hilang.
  const [designing, setDesigning] = useState(false)
  const [designerReady, setDesignerReady] = useState(false)
  if (!editing) return null
  const { page, busy } = editing
  const dirty = contentKey(data) !== editing.saved || editing.chromeDirty
  const live = page.status !== "draft"
  const canPublish = !busy && (dirty || page.status !== "published" || editing.chromePending)

  return (
    // Kolom kiri dan kanan sama lebar, supaya kontrol pratinjau tepat di tengah.
    <header className="grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Tip label="Kembali ke daftar halaman">
          <Link href="/settings/pages/" aria-label="Kembali ke daftar halaman" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
            <ArrowLeftIcon />
          </Link>
        </Tip>
        <Tip label={panels.left ? "Sembunyikan panel blok" : "Tampilkan panel blok"}>
          <Button
            variant="ghost"
            size="icon"
            aria-label={panels.left ? "Sembunyikan panel blok" : "Tampilkan panel blok"}
            aria-pressed={panels.left}
            className="max-md:hidden"
            onClick={() => onTogglePanel("left")}
          >
            {panels.left ? <PanelLeftCloseIcon /> : <PanelLeftOpenIcon />}
          </Button>
        </Tip>
        <Separator orientation="vertical" className="data-vertical:h-4 data-vertical:self-auto" />
        <h1 className="truncate pl-1 text-sm font-semibold" title={`Alamat: ${page.path}`}>
          {page.title}
        </h1>
        <PageStatusBadge status={dirty && live ? "changed" : page.status} />
        {dirty ? (
          <span className="hidden items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground 2xl:flex">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
            Belum disimpan
          </span>
        ) : null}
      </div>

      {children}

      <div className="flex items-center justify-end gap-1">
        {/* Tombol yang tidak aktif tetap menampilkan keterangan: aria-disabled, bukan disabled. */}
        <Tip label={history.hasPast ? "Urungkan perubahan terakhir" : "Belum ada yang bisa diurungkan"}>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Urungkan"
            aria-disabled={!history.hasPast}
            className="aria-disabled:opacity-50"
            onClick={() => history.hasPast && history.back()}
          >
            <Undo2Icon />
          </Button>
        </Tip>
        <Tip label={history.hasFuture ? "Ulangi yang baru diurungkan" : "Belum ada yang bisa diulangi"}>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Ulangi"
            aria-disabled={!history.hasFuture}
            className="aria-disabled:opacity-50"
            onClick={() => history.hasFuture && history.forward()}
          >
            <Redo2Icon />
          </Button>
        </Tip>
        <TryModeToggle />
        <Tip label="Susun atau perbaiki halaman ini dengan ChatGPT atau Claude">
          <Button
            variant="ghost"
            onClick={() => {
              setDesignerReady(true)
              setDesigning(true)
            }}
          >
            <SparklesIcon data-icon="inline-start" />
            AI
          </Button>
        </Tip>
        {designerReady ? (
          <AiDesigner
            open={designing}
            onOpenChange={setDesigning}
            site={editing.site}
            data={data}
            onApply={(content, mode) => {
              dispatch({
                type: "setData",
                data: (previous) => ({ ...previous, content: mode === "replace" ? content : [...previous.content, ...content] }),
                recordHistory: true,
              })
              // Bagian pertama dari AI langsung terpilih: kanvas menggulir ke sana.
              dispatch({ type: "setUi", ui: { itemSelector: { index: mode === "replace" ? 0 : data.content.length, zone: "root:default-zone" } } })
              toast.add({
                type: "success",
                title: `${content.length} bagian dari AI dimasukkan`,
                description: "Belum disimpan. Periksa isinya, unggah fotonya, lalu Simpan draf.",
              })
            }}
          />
        ) : null}
        <Separator orientation="vertical" className="mx-1 data-vertical:h-4 data-vertical:self-auto" />
        <DropdownMenu>
          <Tip label="Pengaturan halaman, riwayat versi, menu & kaki situs">
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Aksi halaman lainnya" />}>
              <EllipsisIcon />
            </DropdownMenuTrigger>
          </Tip>
          <DropdownMenuContent align="end" className="w-fit">
            <DropdownMenuItem onClick={editing.openSettings}>
              <Settings2Icon />
              Pengaturan halaman
            </DropdownMenuItem>
            <DropdownMenuItem onClick={editing.openVersions}>
              <HistoryIcon />
              Riwayat versi
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editing.setPart("header")}>
              <PanelTopIcon />
              Menu & kaki situs
            </DropdownMenuItem>
            {live ? (
              <>
                <DropdownMenuItem render={<a href={publicHref(page.path)} target="_blank" rel="noreferrer" />}>
                  <ArrowUpRightIcon />
                  Lihat halaman yang terbit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" disabled={busy} onClick={editing.unpublish}>
                  Batalkan terbit
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        <Tip label="Tema terang atau gelap editor">
          <span className="inline-flex">
            <ThemeToggle />
          </span>
        </Tip>
        <Tip label={dirty ? "Simpan perubahan tanpa menampilkannya ke pengunjung" : "Tidak ada perubahan yang belum disimpan"}>
          <Button variant="outline" aria-disabled={busy || !dirty} className="aria-disabled:opacity-50" onClick={() => !busy && dirty && editing.save(data)}>
            Simpan draf
          </Button>
        </Tip>
        <Tip label={canPublish ? "Tampilkan halaman ini, navbar, dan kaki situs ke pengunjung" : "Semua sudah terbit"}>
          <Button aria-disabled={!canPublish} className="aria-disabled:opacity-50" onClick={() => canPublish && editing.publish(data)}>
            Terbitkan
          </Button>
        </Tip>
        <Tip label={panels.right ? "Sembunyikan panel isian" : "Tampilkan panel isian"}>
          <Button
            variant="ghost"
            size="icon"
            aria-label={panels.right ? "Sembunyikan panel isian" : "Tampilkan panel isian"}
            aria-pressed={panels.right}
            className="max-lg:hidden"
            onClick={() => onTogglePanel("right")}
          >
            {panels.right ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
          </Button>
        </Tip>
      </div>
    </header>
  )
}

/**
 * Navbar dan kaki situs di kanvas (root halaman merendernya bila konteks ini
 * ada). Memilih salah satunya melepas blok terpilih, supaya panel kanan
 * menampilkan pengaturannya.
 */
function ChromeCanvasProvider({ children }: { children: ReactNode }) {
  const editing = use(EditingContext)
  const dispatch = usePuck((state) => state.dispatch)
  const previewMode = usePuck((state) => state.appState.ui.previewMode)
  if (!editing) return <>{children}</>
  const value: ChromeCanvas = {
    chrome: editing.chrome,
    site: editing.site,
    navigation: editing.navigation,
    current: editing.page.path,
    selected: editing.part,
    trying: previewMode === "interactive",
    select: (part) => {
      dispatch({ type: "setUi", ui: { itemSelector: null } })
      editing.setPart(part)
    },
  }
  return <ChromeCanvasContext value={value}>{children}</ChromeCanvasContext>
}

/**
 * Mode coba: kanvas dirender seperti halaman terbit (mode "interactive"
 * Puck), jadi tab, buka-tutup, video, dan efek bisa dicoba dengan klik.
 * Selama aktif, blok tidak bisa dipilih atau diseret.
 */
function TryModeToggle() {
  const previewMode = usePuck((state) => state.appState.ui.previewMode)
  const dispatch = usePuck((state) => state.dispatch)
  const trying = previewMode === "interactive"
  return (
    <Tip label={trying ? "Selesai mencoba, kembali menyunting" : "Mode coba: klik tab, buka-tutup, dan video seperti pengunjung"}>
      <Button
        variant={trying ? "secondary" : "ghost"}
        size="icon"
        aria-label={trying ? "Selesai mencoba, kembali menyunting" : "Mode coba: klik tab, buka-tutup, dan video di kanvas"}
        aria-pressed={trying}
        onClick={() => dispatch({ type: "setUi", ui: { previewMode: trying ? "edit" : "interactive" } })}
      >
        <PointerIcon />
      </Button>
    </Tip>
  )
}

/**
 * Isian blok terpilih: tab Isi (isian Puck) dan, untuk bagian halaman, tab
 * Tampilan (`appearance`, disimpan ke blok lewat aksi "replace" Puck supaya
 * masuk riwayat urungkan).
 */
function FieldsPanel() {
  const editing = use(EditingContext)
  const selected = usePuck((state) => state.selectedItem)
  const dispatch = usePuck((state) => state.dispatch)
  const getSelectorForId = usePuck((state) => state.getSelectorForId)
  const name = selected?.type as keyof typeof pageConfig.components | undefined
  const label = name ? (pageConfig.components[name]?.label ?? name) : null

  if ((!selected || !name) && editing?.part) {
    return <ChromePanel part={editing.part} chrome={editing.chrome} onChange={editing.setChrome} />
  }

  if (!selected || !name) {
    return (
      <Empty className="flex-1 border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MousePointerClickIcon />
          </EmptyMedia>
          <EmptyTitle>Belum ada blok yang dipilih</EmptyTitle>
          <EmptyDescription>
            Klik satu blok di kanvas untuk mengubah isinya. Klik navbar atau kaki situs untuk mengatur keduanya di semua halaman.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const header = (
    <div className="px-4 pt-3">
      <p className="text-xs text-muted-foreground">Blok terpilih</p>
      <p className="font-semibold">{label}</p>
    </div>
  )
  const fields = (
    <div className="editor-fields min-h-0 flex-1 overflow-y-auto p-4">
      <Puck.Fields wrapFields={false} />
    </div>
  )

  if (!sectionBlocks.includes(name)) {
    return (
      <>
        <div className="border-b pb-3">{header}</div>
        {fields}
      </>
    )
  }

  function saveLook(appearance: Appearance) {
    if (!selected) return
    const selector = getSelectorForId(selected.props.id)
    if (!selector) return
    dispatch({
      type: "replace",
      destinationIndex: selector.index,
      destinationZone: selector.zone,
      data: { ...selected, props: { ...selected.props, appearance } },
    })
  }

  return (
    <Tabs defaultValue="content" className="flex min-h-0 flex-1 flex-col gap-0">
      {header}
      <div className="border-b px-4 pt-3 pb-3">
        <TabsList className="w-full">
          <TabsTrigger value="content">Isi</TabsTrigger>
          <TabsTrigger value="look">Tampilan</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="content" className="flex min-h-0 flex-1 flex-col">
        {fields}
      </TabsContent>
      <TabsContent value="look" className="min-h-0 flex-1 overflow-y-auto p-4">
        <AppearanceInput
          key={selected.props.id}
          id={`look-${selected.props.id}`}
          value={(selected.props as { appearance?: Partial<Appearance> }).appearance}
          onChange={saveLook}
        />
      </TabsContent>
    </Tabs>
  )
}

/**
 * Pratinjau ponsel/komputer dan zoom di tengah navbar. Zoom hanya memperkecil:
 * halaman yang lebih lebar dari kanvas tidak muat, jadi pilihan tertingginya
 * "pas" dengan lebar kanvas.
 */
function PreviewControls({
  viewport,
  zoom,
  fit,
  onViewport,
  onZoom,
}: {
  viewport: Viewport
  zoom: Zoom
  fit: number
  onViewport: (viewport: Viewport) => void
  onZoom: (zoom: Zoom) => void
}) {
  const steps: Zoom[] = [...zoomSteps.filter((step) => step < fit - 0.005), "fit"]
  const current = zoom === "fit" || zoom >= fit - 0.005 ? "fit" : zoom
  const index = steps.indexOf(current)
  const items = steps.map((step) => ({
    value: String(step),
    label: step === "fit" ? `${Math.round(fit * 100)}% (pas)` : `${step * 100}%`,
  }))

  return (
    <div role="toolbar" aria-label="Pratinjau" className="flex items-center gap-2">
      <ToggleGroup
        variant="outline"
        spacing={0}
        value={[viewport]}
        onValueChange={(next: string[]) => {
          const picked = next[0]
          if (picked === "mobile" || picked === "desktop") onViewport(picked)
        }}
      >
        <Tip label="Pratinjau di ponsel (lebar 390 px)">
          <ToggleGroupItem value="mobile" aria-label="Ponsel" className="text-muted-foreground aria-pressed:text-foreground">
            <SmartphoneIcon data-icon="inline-start" />
            <span className="hidden xl:inline">Ponsel</span>
          </ToggleGroupItem>
        </Tip>
        <Tip label="Pratinjau di komputer (lebar 1280 px)">
          <ToggleGroupItem value="desktop" aria-label="Komputer" className="text-muted-foreground aria-pressed:text-foreground">
            <MonitorIcon data-icon="inline-start" />
            <span className="hidden xl:inline">Komputer</span>
          </ToggleGroupItem>
        </Tip>
      </ToggleGroup>

      <ButtonGroup aria-label="Zoom">
        <Tip label={index <= 0 ? "Sudah paling kecil" : "Perkecil pratinjau"}>
          <Button
            variant="outline"
            size="icon"
            aria-label="Perkecil"
            aria-disabled={index <= 0}
            className="aria-disabled:opacity-50"
            onClick={() => index > 0 && onZoom(steps[index - 1] ?? "fit")}
          >
            <ZoomOutIcon />
          </Button>
        </Tip>
        <Select items={items} value={String(current)} onValueChange={(next) => next && onZoom(next === "fit" ? "fit" : Number(next))}>
          <Tip label="Ukuran pratinjau; “pas” mengikuti lebar kanvas">
            <SelectTrigger aria-label="Zoom" className="min-w-28 tabular-nums">
              <SelectValue />
            </SelectTrigger>
          </Tip>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tip label={index >= steps.length - 1 ? "Sudah pas dengan lebar kanvas" : "Perbesar pratinjau"}>
          <Button
            variant="outline"
            size="icon"
            aria-label="Perbesar"
            aria-disabled={index >= steps.length - 1}
            className="aria-disabled:opacity-50"
            onClick={() => index < steps.length - 1 && onZoom(steps[index + 1] ?? "fit")}
          >
            <ZoomInIcon />
          </Button>
        </Tip>
      </ButtonGroup>
    </div>
  )
}

function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return size
}

/**
 * Letak bawaan Puck (Puck 0.23, `DraggableComponent`): lapisan aksi menempel
 * (sticky) 52 px dari atas kanvas, dan bilahnya 44 px di atas lapisan itu.
 */
const actionOverlayTop = 52
const actionBarTop = -44

/**
 * Bilah aksi blok terpilih ikut diperkecil bersama kanvas. Di sini ukurannya
 * dan jaraknya ke blok dikembalikan ke ukuran layar, supaya tetap terbaca
 * pada zoom berapa pun — yang dilakukan kanvas bawaan Puck dengan zoom-nya
 * sendiri, yang tidak terpakai di kerangka editor ini.
 *
 * Bila bilahnya tidak muat, Puck memindahkannya dengan mengubah `top`
 * pembungkusnya. Di letak itu bilah tidak digeser lagi.
 */
function CanvasActionBar({ label, children, parentAction }: { label?: string; children?: ReactNode; parentAction?: ReactNode }) {
  const zoom = use(CanvasZoomContext)
  const bar = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = bar.current
    const holder = element?.parentElement
    if (!element || !holder) return
    // Blok paling atas: bilahnya di dalam blok, di bawah batas sticky ini.
    if (holder.parentElement) holder.parentElement.style.top = `${actionOverlayTop / zoom}px`
    const place = () => {
      const above = holder.style.top === `${actionBarTop}px`
      const lift = above ? actionBarTop * (1 / zoom - 1) : 0
      element.style.transform = `translateY(${lift}px) scale(${1 / zoom})`
    }
    place()
    const observer = new MutationObserver(place)
    observer.observe(holder, { attributes: true, attributeFilter: ["style"] })
    return () => observer.disconnect()
  }, [zoom])
  return (
    <div ref={bar} style={{ transformOrigin: "right top" }}>
      <ActionBar>
        <ActionBar.Group>
          {parentAction}
          {label ? <ActionBar.Label label={label} /> : null}
        </ActionBar.Group>
        <ActionBar.Group>{children}</ActionBar.Group>
      </ActionBar>
    </div>
  )
}

/**
 * Kanvas Puck adalah iframe: kelas tema di <html> halaman ini tidak sampai ke
 * dalamnya. Tema yang berlaku disalin ke dokumen iframe, supaya blok di kanvas
 * tampil dengan tema yang sama dengan editor dan dengan situs publiknya.
 */
function CanvasFrame({ children, document: frame }: { children: ReactNode; document?: Document }) {
  const { resolvedTheme } = useTheme()
  useEffect(() => {
    if (!frame) return
    // Kelas <html> aplikasi membawa variabel font; tanpa itu kanvas memakai
    // huruf bawaan peramban.
    frame.documentElement.classList.add(...Array.from(document.documentElement.classList).filter((name) => name !== "dark" && name !== "light"))
    frame.documentElement.classList.toggle("dark", resolvedTheme === "dark")
    frame.body.classList.add("bg-background", "text-foreground", "font-sans")
  }, [frame, resolvedTheme])

  // Tautan di kanvas (terutama di mode coba) tidak membawa ke mana pun: tidak
  // membuka halaman lain, tab baru, atau /auth/login. Satu-satunya yang jalan
  // adalah jangkar ke id bagian di halaman ini ("#harga"), yang menggulir ke sana.
  useEffect(() => {
    if (!frame) return
    const stay = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]")
      if (!link) return
      event.preventDefault()
      const href = link.getAttribute("href") ?? ""
      if (href.length > 1 && href.startsWith("#")) {
        frame.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }
    frame.addEventListener("click", stay, true)
    return () => frame.removeEventListener("click", stay, true)
  }, [frame])
  return <InCanvasContext value={true}>{children}</InCanvasContext>
}

function BackLink() {
  return (
    <Link href="/settings/pages/" className={cn(buttonVariants({ variant: "outline" }), "self-start")}>
      <ArrowLeftIcon data-icon="inline-start" />
      Kembali ke daftar halaman
    </Link>
  )
}

function Blocked({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <Empty className="min-h-svh">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LockIcon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        {action}
        <BackLink />
      </EmptyContent>
    </Empty>
  )
}
