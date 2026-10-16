"use client"

import { Suspense, useEffect, useMemo, useSyncExternalStore } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Render } from "@puckeditor/core"
import { FlaskConicalIcon } from "lucide-react"
import { cn } from "cn"

import { publicHref, publicNavigation, publishedChrome, publishedPage, type NavigationLink, type PublishedPage, type SiteChrome } from "@/lib/pages"
import { PageLoading } from "@/components/app-shell/page-loading"
import { CompanySite, SignInOnly } from "@/components/landing/home"
import { SiteGate, useSite, useSiteName } from "@/components/landing/site-context"
import { pageConfig } from "@/components/pages/config"
import { migrateContent } from "@/components/pages/migrate"
import { SiteFooter, SiteHeader, type ChromeContext } from "@/components/pages/site-chrome"
import { buttonVariants } from "@/components/ui/button"

/** Halaman publik untuk ?alamat=, seperti yang kelak dilihat pengunjung. */
export function SiteScreen() {
  return (
    <Suspense fallback={<PageLoading label="Membuka halaman…" className="min-h-svh" />}>
      <SiteGate fallback={<PageLoading label="Membuka halaman…" className="min-h-svh" />}>
        <PublicPage />
      </SiteGate>
    </Suspense>
  )
}

type Loaded = { page: PublishedPage | null; navigation: NavigationLink[]; chrome: SiteChrome }

// Data tiruan ada di localStorage, yang hanya ada di peramban: dibaca sesudah
// halaman terpasang, tidak saat prerender.
const subscribe = () => () => {}
const onClient = () => true
const onServer = () => false

function PublicPage() {
  const path = useSearchParams().get("alamat") || "/"
  const site = useSite()
  const client = useSyncExternalStore(subscribe, onClient, onServer)
  const loaded = useMemo<Loaded | null>(
    () => (client ? { page: publishedPage(path), navigation: publicNavigation(), chrome: publishedChrome() } : null),
    [client, path]
  )

  if (!loaded) return <PageLoading label="Membuka halaman…" className="min-h-svh" />

  let content: React.ReactNode
  if (site.mode === "signin") {
    // Tanpa web publik, halaman yang terbit pun tidak tampil.
    content = path === "/" ? <SignInOnly /> : <NotFound chrome={loaded.chrome} navigation={[]} />
  } else if (loaded.page) {
    content = <RenderedPage page={loaded.page} navigation={loaded.navigation} chrome={loaded.chrome} />
  } else if (path === "/") {
    // Belum ada beranda terbit: halaman identitas dari Profil bisnis dan Website.
    content = <CompanySite />
  } else {
    content = <NotFound chrome={loaded.chrome} navigation={loaded.navigation} />
  }

  return (
    <>
      <PrototypeBar path={path} />
      {content}
    </>
  )
}

/** Hanya di prototipe: mengingatkan alamat sungguhan halaman ini. */
function PrototypeBar({ path }: { path: string }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b bg-muted px-4 py-2 text-center text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <FlaskConicalIcon aria-hidden="true" className="size-3.5" />
        Pratinjau prototipe — kelak halaman ini tampil di alamat <span className="font-mono text-foreground">{path}</span>
      </span>
      <Link href="/settings/pages/" className="font-medium text-foreground underline underline-offset-4">
        Kembali ke Halaman
      </Link>
    </div>
  )
}

/** Navbar dan kaki situs yang terbit (site-chrome.tsx), sama dengan yang tampil di editor. */
function useChromeContext(navigation: NavigationLink[], current: string): ChromeContext {
  const site = useSite()
  return { site, navigation, current, linkFor: publicHref, editing: false }
}

function RenderedPage({ page, navigation, chrome }: { page: PublishedPage; navigation: NavigationLink[]; chrome: SiteChrome }) {
  const site = useSite()
  const name = useSiteName()
  const ctx = useChromeContext(navigation, page.path)
  useEffect(() => {
    document.title = page.seo.title || (page.path === "/" ? name : `${page.title} · ${name}`)
  }, [page, name])

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader settings={chrome.header} ctx={ctx} />
      <main className="flex-1">
        <Render config={pageConfig} data={migrateContent(page.data)} metadata={{ site, linkFor: publicHref }} />
      </main>
      <SiteFooter settings={chrome.footer} ctx={ctx} />
    </div>
  )
}

function NotFound({ chrome, navigation }: { chrome: SiteChrome; navigation: NavigationLink[] }) {
  const ctx = useChromeContext(navigation, "")
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader settings={chrome.header} ctx={ctx} />
      <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">Halaman tidak ditemukan</h1>
        <p className="text-muted-foreground">Halaman ini tidak ada, belum terbit, atau sudah dipindahkan.</p>
        <a href={publicHref("/")} className={cn(buttonVariants({ variant: "outline" }))}>
          Ke beranda
        </a>
      </main>
    </div>
  )
}
