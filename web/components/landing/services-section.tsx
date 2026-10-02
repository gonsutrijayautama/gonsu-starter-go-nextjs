import { ArrowRightIcon } from "lucide-react"
import { cn } from "cn"

import { site } from "@/lib/site"
import { Frame, FramePanel } from "@/components/reui/frame"
import { IconTile } from "@/components/reui/icon-tile"
import { buttonVariants } from "@/components/ui/button"

import { SectionHeading, SitePhoto } from "./decor"

/** Tentang perusahaan di kiri, daftar layanan di kanan. */
export function ServicesSection() {
  return (
    <section id="layanan" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20 sm:px-6 lg:py-28">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <SectionHeading eyebrow="Tentang & layanan" title="Yang bisa kami kerjakan untuk Anda" description={site.summary} />
        <a href="#kontak" className={cn(buttonVariants({ variant: "outline" }), "self-start md:self-auto")}>
          Hubungi kami
          <ArrowRightIcon data-icon="inline-end" />
        </a>
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-2">
        <Frame id="tentang" className="scroll-mt-20">
          <FramePanel className="flex flex-col gap-5 p-2">
            <SitePhoto label="Foto kantor atau tim" className="aspect-16/10 w-full rounded-lg" />
            <div className="flex flex-col gap-2 px-4 pb-4">
              <h3 className="text-lg font-semibold tracking-tight">Tentang {site.name}</h3>
              <p className="text-pretty text-muted-foreground">{site.about.text}</p>
            </div>
          </FramePanel>
        </Frame>

        {/* SATU Frame, banyak FramePanel (docs/ui-guide.md). */}
        <Frame>
          {site.services.map(({ title, description, icon: Icon }) => (
            <FramePanel key={title} className="flex items-center gap-4">
              <IconTile aria-hidden="true">
                <Icon />
              </IconTile>
              <div className="space-y-1">
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-pretty text-muted-foreground">{description}</p>
              </div>
            </FramePanel>
          ))}
        </Frame>
      </div>
    </section>
  )
}
