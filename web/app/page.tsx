import type { Metadata } from "next"

import { site } from "@/lib/site"
import { ContactSection } from "@/components/landing/contact-section"
import { Hero } from "@/components/landing/hero"
import { ServicesSection } from "@/components/landing/services-section"
import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"

// Halaman publik "/": web perusahaan tenant sekaligus pintu masuk aplikasi.
// Chart GONSU memakai "/" sebagai probe, jadi halaman ini tidak boleh
// bergantung pada sesi maupun API — isinya dari lib/site.ts.
export const metadata: Metadata = {
  title: { absolute: site.name },
  description: site.summary,
}

export default function HomePage() {
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
