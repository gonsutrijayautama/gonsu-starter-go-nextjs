"use client"

import { ArrowRightIcon } from "lucide-react"
import { cn } from "cn"

import { siteIcon } from "@/lib/site-icons"
import { Frame, FramePanel } from "@/components/reui/frame"
import { IconTile } from "@/components/reui/icon-tile"
import { buttonVariants } from "@/components/ui/button"

import { SectionHeading, SitePhoto } from "./decor"
import { siteSections } from "./sections"
import { useSite, useSiteName } from "./site-context"

/**
 * Tentang bisnisnya di kiri, daftar layanan di kanan. Bagian yang belum diisi
 * tidak dirender; bila keduanya kosong, seluruh bagian ini hilang.
 */
export function ServicesSection() {
  const site = useSite()
  const name = useSiteName()
  const has = siteSections(site)
  if (!has.about && !has.services) return null

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <SectionHeading
          eyebrow={has.about && has.services ? "Tentang & layanan" : has.services ? "Layanan" : "Tentang kami"}
          title={has.services ? "Yang bisa kami kerjakan untuk Anda" : `Mengenal ${name}`}
        />
        {has.contact ? (
          <a href="#kontak" className={cn(buttonVariants({ variant: "outline" }), "self-start md:self-auto")}>
            Hubungi kami
            <ArrowRightIcon data-icon="inline-end" />
          </a>
        ) : null}
      </div>

      <div className={cn("mt-12 grid gap-4", has.about && has.services ? "lg:grid-cols-2" : "max-w-3xl")}>
        {has.about ? (
          <Frame id="tentang" className="scroll-mt-20">
            <FramePanel className="flex flex-col gap-5 p-2">
              <SitePhoto className="aspect-16/10 w-full rounded-lg" />
              <div className={cn("flex flex-col gap-2 px-4 pb-4", site.about.image_url ? "" : "pt-4")}>
                <h3 className="text-lg font-semibold tracking-tight">Tentang {name}</h3>
                {/* Baris baru yang diketik pengelola dipertahankan. */}
                <p className="text-pretty whitespace-pre-line text-muted-foreground">{site.about.text}</p>
              </div>
            </FramePanel>
          </Frame>
        ) : null}

        {/* SATU Frame, banyak FramePanel (docs/ui-guide.md). */}
        {has.services ? (
          <Frame id="layanan" className="scroll-mt-20">
            {site.services.map((service, index) => {
              const Icon = siteIcon(service.icon)
              return (
                <FramePanel key={index} className="flex items-center gap-4">
                  <IconTile aria-hidden="true">
                    <Icon />
                  </IconTile>
                  <div className="space-y-1">
                    <h3 className="font-semibold">{service.title}</h3>
                    {service.description ? (
                      <p className="text-sm text-pretty text-muted-foreground">{service.description}</p>
                    ) : null}
                  </div>
                </FramePanel>
              )
            })}
          </Frame>
        ) : null}
      </div>
    </section>
  )
}
