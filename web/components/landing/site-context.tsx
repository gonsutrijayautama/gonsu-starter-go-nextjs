"use client"

import { createContext, use, useEffect, useState, useSyncExternalStore, type ReactNode } from "react"

import { product } from "@/lib/product"
import { emptySite, fetchSite, readInjectedSite, type Site } from "@/lib/site"

const SiteContext = createContext<Site | null>(null)

/** Data halaman depan. Hanya dipakai di dalam `SiteGate`. */
export function useSite(): Site {
  const site = use(SiteContext)
  if (!site) throw new Error("useSite dipakai di luar SiteGate")
  return site
}

/** Nama yang ditampilkan: nama bisnis, atau nama produk selama profil belum diisi. */
export function useSiteName(): string {
  return useSite().name || product.name
}

// Data yang disisipkan server dibaca sekali per halaman. `undefined`: belum
// dibaca (prerender dan saat hydration); `null`: halaman ini tidak disisipi.
let injected: Site | null | undefined
const subscribe = () => () => {}
function clientSnapshot() {
  if (injected === undefined) injected = readInjectedSite()
  return injected
}
const serverSnapshot = () => undefined

/**
 * Menyediakan data halaman depan bagi isinya.
 *
 * Halaman "/" di-prerender saat build, sebelum ada bisnis mana pun, jadi
 * prerender hanya memuat `fallback`. Di peramban, data dibaca dari JSON yang
 * disisipkan server Go — tanpa permintaan jaringan — dan isinya langsung
 * tampil. `useSyncExternalStore` yang membuat keduanya cocok saat hydration.
 *
 * Halaman yang tidak disisipi (`make web-dev`) mengambil /site.json. Bila itu
 * pun gagal, halaman tetap jadi pintu masuk: "/" tidak boleh bergantung pada
 * API.
 */
export function SiteGate({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  const fromPage = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
  const [fetched, setFetched] = useState<Site | null>(null)

  useEffect(() => {
    if (fromPage !== null) return
    const controller = new AbortController()
    fetchSite(controller.signal)
      .then(setFetched)
      .catch(() => {
        if (!controller.signal.aborted) setFetched(emptySite)
      })
    return () => controller.abort()
  }, [fromPage])

  const site = fromPage ?? fetched

  // Judul tab mengikuti data bisnis. Server sudah menyisipkan judul yang
  // benar ke HTML, tetapi Next menulis ulang <title> dari metadata build —
  // saat hydration, dan lagi sesudahnya — jadi sekali menyetelnya tidak
  // cukup: judulnya dijaga selama halaman ini terbuka.
  useEffect(() => {
    if (!site) return
    const title = site.seo.title || site.name || product.name
    const keep = () => {
      if (document.title !== title) document.title = title
    }
    keep()
    const observer = new MutationObserver(keep)
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [site])

  if (!site) return fallback
  return <SiteContext value={site}>{children}</SiteContext>
}
