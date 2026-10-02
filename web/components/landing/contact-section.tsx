"use client"

import { ArrowUpRightIcon, ClockIcon, MailIcon, MapPinIcon, PhoneIcon, type LucideIcon } from "lucide-react"
import { cn } from "cn"

import { channelLinks, emailHref, phoneHref } from "@/lib/site"
import { Frame, FramePanel } from "@/components/reui/frame"
import { IconTile } from "@/components/reui/icon-tile"
import { buttonVariants } from "@/components/ui/button"

import { GridPattern, SectionHeading } from "./decor"
import { siteSections } from "./sections"
import { useSite, useSiteName } from "./site-context"

interface ContactEntry {
  icon: LucideIcon
  label: string
  value: string
  href?: string
}

/**
 * Alamat, telepon, email, jam kerja, dan kanal lain, di samping ilustrasi
 * lokasi. Hanya yang diisi yang tampil.
 */
export function ContactSection() {
  const site = useSite()
  if (!siteSections(site).contact) return null

  const { contact } = site
  const entries: ContactEntry[] = [
    // Alamat disembunyikan: kotanya saja yang tampil.
    { icon: MapPinIcon, label: "Alamat", value: contact.address || contact.city },
    { icon: PhoneIcon, label: "Telepon", value: contact.phone, href: phoneHref(contact.phone) },
    { icon: MailIcon, label: "Email", value: contact.email, href: emailHref(contact.email) },
    { icon: ClockIcon, label: "Jam kerja", value: contact.hours },
  ].filter((entry) => entry.value)
  const channels = channelLinks(site.channels)

  return (
    <section id="kontak" className="mx-auto max-w-6xl scroll-mt-16 px-4 pb-20 sm:px-6 lg:pb-28">
      <Frame className="lg:flex-row">
        <FramePanel className="flex flex-col justify-center gap-8 lg:basis-0 lg:p-10">
          <SectionHeading
            eyebrow="Kontak"
            title="Mampir atau hubungi kami"
            description="Ada pertanyaan soal layanan kami? Pilih cara yang paling mudah untuk Anda."
          />
          <ul className="grid gap-5 sm:grid-cols-2">
            {entries.map((entry) => (
              <ContactItem key={entry.label} {...entry} />
            ))}
          </ul>
          {channels.length > 0 ? (
            <ul aria-label="Kanal lain" className="flex flex-wrap gap-2">
              {channels.map((channel) => (
                <li key={channel.label}>
                  <a
                    href={channel.href}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(buttonVariants({ variant: "outline" }))}
                  >
                    {channel.label}
                    <ArrowUpRightIcon data-icon="inline-end" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </FramePanel>
        <FramePanel className="relative min-h-80 overflow-hidden bg-muted/60 p-0 lg:basis-0">
          <LocationIllustration />
          {contact.map_url ? (
            <a
              href={contact.map_url}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline" }), "absolute right-4 bottom-4")}
            >
              Buka di peta
              <ArrowUpRightIcon data-icon="inline-end" />
            </a>
          ) : null}
        </FramePanel>
      </Frame>
    </section>
  )
}

function ContactItem({ icon: Icon, label, value, href }: ContactEntry) {
  return (
    <li className="flex gap-3">
      <IconTile size="sm" aria-hidden="true">
        <Icon />
      </IconTile>
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">
          {href ? (
            <a href={href} className="underline-offset-4 hover:underline">
              {value}
            </a>
          ) : (
            value
          )}
        </p>
      </div>
    </li>
  )
}

/**
 * Peta gambaran, bukan peta sungguhan: menyematkan layanan peta pihak ketiga
 * mengirim alamat IP setiap pengunjung ke sana. Peta asli dibuka lewat
 * tombol "Buka di peta" (tautan peta di pengaturan website).
 */
function LocationIllustration() {
  const site = useSite()
  const name = useSiteName()
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <GridPattern className="bg-size-[2rem_2rem]" />
      <div className="absolute top-2/5 -left-10 h-3.5 w-[140%] -rotate-12 border-y bg-card" />
      <div className="absolute top-[70%] -left-10 h-2.5 w-[140%] rotate-6 border-y bg-card" />
      <div className="absolute -top-16 left-3/5 h-[140%] w-3.5 rotate-18 border-x bg-card" />
      <div className="absolute top-10 left-12 h-18 w-30 rounded-lg border bg-primary/5" />
      <div className="absolute right-12 bottom-14 h-22 w-28 rounded-lg border bg-primary/5" />
      <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-3/4 flex-col items-center gap-3">
        <div className="rounded-xl border bg-card px-3.5 py-2.5 whitespace-nowrap shadow-lg">
          <p className="text-sm font-semibold">{name}</p>
          {site.contact.city ? <p className="text-xs text-muted-foreground">{site.contact.city}</p> : null}
        </div>
        <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground ring-8 ring-primary/15">
          <MapPinIcon className="size-4.5" />
        </span>
      </div>
    </div>
  )
}
