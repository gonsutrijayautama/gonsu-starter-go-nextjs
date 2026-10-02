"use client"

import { product } from "@/lib/product"
import { Copyright } from "@/components/app-shell/copyright"
import { PageLoading } from "@/components/app-shell/page-loading"

import { ContactSection } from "./contact-section"
import { GridPattern } from "./decor"
import { Hero } from "./hero"
import { ServicesSection } from "./services-section"
import { SignInCard } from "./sign-in-card"
import { SiteGate, useSite, useSiteName } from "./site-context"
import { SiteFooter } from "./site-footer"
import { SiteHeader } from "./site-header"

/**
 * Halaman depan "/": web perusahaan bisnis ini, atau hanya pintu masuk —
 * menurut pengaturan website-nya (Pengaturan → Website).
 */
export function Home() {
  return (
    // Prerender saat build belum tahu bisnisnya, jadi yang ter-build hanya
    // keadaan menunggu; isinya tampil begitu data yang disisipkan server
    // dibaca di peramban.
    <SiteGate fallback={<PageLoading label="Membuka halaman…" className="min-h-svh" />}>
      <HomeContent />
    </SiteGate>
  )
}

function HomeContent() {
  const site = useSite()
  return site.mode === "site" ? <CompanySite /> : <SignInOnly />
}

/** Web perusahaan: pembuka, tentang dan layanan, kontak. */
function CompanySite() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <ServicesSection />
        <ContactSection />
      </main>
      <SiteFooter />
    </div>
  )
}

/** Hanya pintu masuk: bisnis ini tidak memajang web publik. */
function SignInOnly() {
  const name = useSiteName()
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader menu={false} />
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
        <GridPattern className="[mask-image:radial-gradient(ellipse_60%_60%_at_50%_40%,black_20%,transparent_70%)]" />
        <SignInCard className="relative" />
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Copyright holder={name} className="p-0" />
          <p>Aplikasi {product.name} berjalan di GONSU One</p>
        </div>
      </footer>
    </div>
  )
}
