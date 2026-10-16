"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowUpRightIcon, EllipsisIcon, FileStackIcon, FlaskConicalIcon, InfoIcon, PanelTopIcon, PlusIcon } from "lucide-react"
import { cn } from "cn"

import { useResource } from "@/hooks/use-resource"
import { toApiError, type ApiError } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import {
  deletePage,
  editorHref,
  importLegacy,
  publicHref,
  listPages,
  resetPrototype,
  setPagesEnabled,
  unpublishPage,
  type LegacyContent,
  type PageSummary,
} from "@/lib/pages"
import { Permission } from "@/lib/permissions"
import { portalLinks } from "@/lib/portal"
import { runWithToast } from "@/lib/toast-action"
import { websitePath, type WebsiteSettings } from "@/lib/website"
import { ApiFailure } from "@/components/api-failure"
import { ConfirmAction } from "@/components/app-shell/confirm-action"
import { PageLoading } from "@/components/app-shell/page-loading"
import { DataTable, type ColumnDef, type DataGridFeatures } from "@/components/data-table"
import { PageHeader } from "@/components/page-header"
import { PageSettingsSheet, PageStatusBadge, VersionsSheet } from "@/components/pages/page-sheets"
import { useCan, usePortal } from "@/components/session-provider"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/reui/alert"
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { CreatePageDialog } from "./create-page-dialog"

type Listing = { data: PageSummary[]; enabled: boolean; legacy: LegacyContent | null }

/** Data tiruan dibaca seperti resource GET: `reload` sesudah setiap perubahan. */
function usePages() {
  const [state, setState] = useState<{ data?: Listing; error?: ApiError; loading: boolean }>({ loading: true })
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let live = true
    listPages()
      .then((data) => live && setState({ data, loading: false }))
      .catch((err) => live && setState((prev) => ({ data: prev.data, error: toApiError(err), loading: false })))
    return () => {
      live = false
    }
  }, [version])
  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { ...state, reload }
}

type Pending = { kind: "delete" | "unpublish"; page: PageSummary }

/**
 * PROTOTIPE layar Halaman: daftar halaman situs, membuatnya, dan pintu ke
 * editornya. Data tiruan di peramban (lib/pages.ts).
 */
export function PagesScreen() {
  const can = useCan()
  const portal = usePortal()
  const router = useRouter()
  const { data, error, loading, reload } = usePages()
  const website = useResource<WebsiteSettings>(websitePath)
  const [creating, setCreating] = useState(false)
  const [settingsFor, setSettingsFor] = useState<PageSummary | null>(null)
  const [versionsFor, setVersionsFor] = useState<PageSummary | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)

  const enabled = data?.enabled ?? true
  const columns = useMemo<ColumnDef<DataGridFeatures, PageSummary>[]>(
    () => [
      {
        id: "title",
        accessorFn: (page) => page.title,
        header: ({ column }) => <DataGridColumnHeader title="Halaman" column={column} />,
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-2 font-medium">
              {enabled ? (
                <Link href={editorHref(row.original.id)} className="truncate underline-offset-4 hover:underline">
                  {row.original.title}
                </Link>
              ) : (
                <span className="truncate">{row.original.title}</span>
              )}
              {row.original.path === "/" ? <span className="text-xs font-normal text-muted-foreground">Beranda</span> : null}
            </span>
            <span className="truncate font-mono text-xs text-muted-foreground">{row.original.path}</span>
          </div>
        ),
        size: 300,
      },
      {
        id: "status",
        accessorFn: (page) => ({ draft: "Draf", published: "Terbit", changed: "Ada perubahan belum terbit" })[page.status],
        header: ({ column }) => <DataGridColumnHeader title="Status" column={column} />,
        cell: ({ row }) => <PageStatusBadge status={row.original.status} />,
        size: 210,
      },
      {
        id: "menu",
        accessorFn: (page) => (page.navigation.visible && page.path !== "/" ? page.navigation.position : Number.MAX_SAFE_INTEGER),
        header: ({ column }) => <DataGridColumnHeader title="Di menu" column={column} />,
        cell: ({ row }) =>
          row.original.navigation.visible && row.original.path !== "/" ? (
            <span>Urutan {row.original.navigation.position}</span>
          ) : (
            <span className="text-muted-foreground">Tidak tampil</span>
          ),
        size: 140,
      },
      {
        id: "updated",
        accessorFn: (page) => page.updated_at,
        header: ({ column }) => <DataGridColumnHeader title="Terakhir diubah" column={column} />,
        cell: ({ row }) => <span className="text-muted-foreground">{formatDateTime(row.original.updated_at)}</span>,
        size: 190,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        size: 56,
        cell: ({ row }) => (
          <PageActions
            page={row.original}
            enabled={enabled}
            onSettings={setSettingsFor}
            onVersions={setVersionsFor}
            onPending={setPending}
          />
        ),
      },
    ],
    [enabled]
  )

  if (!can(Permission.SettingsWebsiteManage)) {
    return (
      <>
        <PageHeader title="Halaman" />
        <p className="text-sm text-muted-foreground">Role Anda belum bisa mengatur halaman situs.</p>
      </>
    )
  }

  const pages = data?.data ?? []
  const hasHome = pages.some((page) => page.path === "/")
  // Navbar dan kaki situs disunting di editor, di atas halaman beranda (atau halaman pertama).
  const chromeHost = pages.find((page) => page.path === "/") ?? pages[0]
  const signinOnly = website.data?.mode === "signin"

  function applyPending() {
    if (!pending) return
    const { kind, page } = pending
    const action =
      kind === "delete"
        ? runWithToast(deletePage(page.id), { loading: "Menghapus halaman…", success: `Halaman “${page.title}” dihapus` })
        : runWithToast(unpublishPage(page.id), { loading: "Membatalkan terbit…", success: `“${page.title}” tidak lagi tampil` })
    action.then(reload).catch(() => undefined)
  }

  function runImport() {
    runWithToast(importLegacy(), {
      loading: "Mengimpor isi website lama…",
      success: { title: "Isi lama masuk ke draf beranda", description: "Periksa dulu, lalu terbitkan dari editor." },
    })
      .then((home) => router.push(editorHref(home.id)))
      .catch(() => undefined)
  }

  return (
    <>
      <PageHeader
        title="Halaman"
        description="Halaman situs yang dilihat pengunjung: beranda dan halaman lain yang Anda susun sendiri."
        action={
          <div className="flex flex-wrap gap-2">
            {chromeHost && enabled ? (
              <Link href={`${editorHref(chromeHost.id)}&bagian=navbar`} className={cn(buttonVariants({ variant: "outline" }))}>
                <PanelTopIcon data-icon="inline-start" />
                Menu & kaki situs
              </Link>
            ) : null}
            <Button onClick={() => setCreating(true)} disabled={!data || !enabled}>
              <PlusIcon data-icon="inline-start" />
              Buat halaman
            </Button>
          </div>
        }
      />

      {error ? <ApiFailure error={error} onRetry={reload} /> : null}

      {!enabled ? (
        <Alert variant="warning">
          <InfoIcon />
          <AlertTitle>Paket Anda belum termasuk penyusun halaman</AlertTitle>
          <AlertDescription>Halaman yang sudah terbit tetap tampil, tapi tidak bisa ditambah atau diubah.</AlertDescription>
          {portal ? (
            <AlertAction>
              <a href={portalLinks.plans} className={cn(buttonVariants({ variant: "outline" }))}>
                Lihat paket
              </a>
            </AlertAction>
          ) : null}
        </Alert>
      ) : null}

      {signinOnly ? (
        <Alert variant="info">
          <InfoIcon />
          <AlertDescription>
            Website sedang memakai pilihan <strong>Hanya pintu masuk</strong>, jadi halaman yang terbit belum tampil ke pengunjung.
          </AlertDescription>
          <AlertAction>
            <Link href="/settings/website/" className={cn(buttonVariants({ variant: "outline" }))}>
              Ubah di Website
            </Link>
          </AlertAction>
        </Alert>
      ) : null}

      {data?.legacy && enabled ? (
        <Alert variant="info">
          <FileStackIcon />
          <AlertTitle>Isi website lama bisa dipindahkan</AlertTitle>
          <AlertDescription>
            Teks “Tentang kami” dan {data.legacy.services.length} layanan dari pengaturan Website lama bisa dijadikan draf beranda.
          </AlertDescription>
          <AlertAction>
            <Button variant="outline" onClick={runImport}>
              Impor ke beranda
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      {loading && !data ? (
        <PageLoading label="Memuat halaman…" />
      ) : (
        <DataTable
          title="Semua halaman"
          toolbar={
            <a href={publicHref("/")} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline" }))}>
              Lihat situs
              <ArrowUpRightIcon data-icon="inline-end" />
            </a>
          }
          data={pages}
          columns={columns}
          emptyMessage="Belum ada halaman. Mulai dari beranda."
        />
      )}

      <PrototypeTools enabled={enabled} onChanged={reload} />

      <CreatePageDialog
        open={creating}
        onOpenChange={setCreating}
        hasHome={hasHome}
        onCreated={(page) => router.push(editorHref(page.id))}
      />
      <PageSettingsSheet
        page={settingsFor}
        open={settingsFor !== null}
        onOpenChange={(open) => !open && setSettingsFor(null)}
        onSaved={() => {
          setSettingsFor(null)
          reload()
        }}
      />
      <VersionsSheet
        page={versionsFor}
        open={versionsFor !== null}
        onOpenChange={(open) => !open && setVersionsFor(null)}
        canRestore={enabled}
        onRestored={(page) => router.push(editorHref(page.id))}
      />
      <ConfirmAction
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        destructive
        title={pending?.kind === "delete" ? `Hapus halaman “${pending.page.title}”?` : `Batalkan terbit “${pending?.page.title ?? ""}”?`}
        description={
          pending?.kind === "delete"
            ? "Halaman, drafnya, dan riwayat versinya hilang. Alamatnya bisa dipakai halaman lain."
            : "Halaman ini hilang dari situs dan dari menu. Drafnya tetap tersimpan dan bisa diterbitkan lagi."
        }
        confirmLabel={pending?.kind === "delete" ? "Hapus" : "Batalkan terbit"}
        onConfirm={applyPending}
      />
    </>
  )
}

function PageActions({
  page,
  enabled,
  onSettings,
  onVersions,
  onPending,
}: {
  page: PageSummary
  enabled: boolean
  onSettings: (page: PageSummary) => void
  onVersions: (page: PageSummary) => void
  onPending: (pending: Pending) => void
}) {
  const published = page.status !== "draft"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Aksi untuk ${page.title}`} />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-fit">
        {enabled ? (
          <>
            <DropdownMenuItem render={<Link href={editorHref(page.id)} />}>Susun isi</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSettings(page)}>Pengaturan</DropdownMenuItem>
          </>
        ) : null}
        {published ? (
          <DropdownMenuItem render={<a href={publicHref(page.path)} target="_blank" rel="noreferrer" />}>Lihat halaman</DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={() => onVersions(page)}>Riwayat versi</DropdownMenuItem>
        <DropdownMenuSeparator />
        {published && enabled ? (
          <DropdownMenuItem onClick={() => onPending({ kind: "unpublish", page })}>Batalkan terbit</DropdownMenuItem>
        ) : null}
        <DropdownMenuItem variant="destructive" onClick={() => onPending({ kind: "delete", page })}>
          Hapus
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Hanya di prototipe: mencoba keadaan yang kelak ditentukan paket dan server. */
function PrototypeTools({ enabled, onChanged }: { enabled: boolean; onChanged: () => void }) {
  const [resetting, setResetting] = useState(false)
  return (
    <Frame className="w-full">
      <FrameHeader>
        <FrameTitle className="flex items-center gap-2">
          <FlaskConicalIcon aria-hidden="true" className="size-4" />
          Alat prototipe
        </FrameTitle>
        <FrameDescription>Hanya ada di prototipe ini, untuk mencoba keadaan yang kelak diatur paket dan server.</FrameDescription>
      </FrameHeader>
      <FramePanel className="flex flex-col gap-4">
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="prototype-enabled">Paket menyertakan penyusun halaman</FieldLabel>
            <FieldDescription>Matikan untuk melihat layar saat paket tidak menyertakannya.</FieldDescription>
          </FieldContent>
          <Switch
            id="prototype-enabled"
            checked={enabled}
            onCheckedChange={(checked) => {
              setPagesEnabled(checked)
              onChanged()
            }}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setResetting(true)}>
            Kembalikan data contoh
          </Button>
          <span className="text-sm text-muted-foreground">Data tiruan tersimpan di peramban ini saja.</span>
        </div>
      </FramePanel>
      <ConfirmAction
        open={resetting}
        onOpenChange={setResetting}
        destructive
        title="Kembalikan data contoh?"
        description="Semua halaman di prototipe ini diganti tiga halaman contoh."
        confirmLabel="Kembalikan"
        onConfirm={() => {
          resetPrototype()
          onChanged()
        }}
      />
    </Frame>
  )
}
