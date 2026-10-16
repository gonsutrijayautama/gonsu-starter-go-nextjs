"use client"

import Image from "next/image"
import { useState, type ReactNode } from "react"
import { ArrowRightIcon, ChevronDownIcon, LogInIcon, MenuIcon, XIcon } from "lucide-react"
import { cn } from "cn"

import type { Banner, FooterSettings, HeaderSettings, NavItem, NavigationLink, SiteLink } from "@/lib/pages"
import { product } from "@/lib/product"
import { channelLinks, emailHref, phoneHref, type Site } from "@/lib/site"
import { Copyright } from "@/components/app-shell/copyright"
import { BusinessAvatar } from "@/components/app-shell/generated-avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

import { ChromeScope, ColorScope } from "./appearance"
import { Marquee } from "./effects"
import { PageIcon } from "./page-icon"

// Navbar dan kaki situs: sekali per situs, dengan beberapa varian. Komponen
// yang sama dirender di halaman publik dan di kanvas editor. Nama, logo,
// kontak, dan kanal dibaca dari Profil bisnis dan Website (`site`).

export type ChromeContext = {
  site: Site
  /** Halaman terbit bertanda "Tampil di menu", sudah urut. */
  navigation: NavigationLink[]
  /** Alamat halaman yang sedang tampil, untuk menandai menu aktif. */
  current: string
  /** Alamat sungguhan untuk "/halaman". */
  linkFor: (path: string) => string
  /** Di editor tautan tidak dibuka dan menu ponsel tidak dibuka: klik memilih navbar. */
  editing: boolean
}

function hrefOf(link: string, ctx: ChromeContext): string | undefined {
  const value = link.trim()
  if (ctx.editing || !value) return undefined
  if (value.startsWith("#")) return value
  if (value.startsWith("/")) return ctx.linkFor(value)
  return /^https:\/\/\S+$/.test(value) ? value : undefined
}

function nameOf(site: Site): string {
  return site.name || product.name
}

function ChromeLogo({ site, className }: { site: Site; className?: string }) {
  const name = nameOf(site)
  if (site.logo_url) {
    return <Image src={site.logo_url} alt="" width={32} height={32} unoptimized className={cn("size-8 rounded-md object-contain", className)} />
  }
  return <BusinessAvatar seed={name} name={name} className={cn("size-8", className)} />
}

function Brand({ ctx, large }: { ctx: ChromeContext; large?: boolean }) {
  return (
    <a href={hrefOf("/", ctx)} className={cn("flex min-w-0 items-center gap-2.5 font-semibold tracking-tight", large && "text-lg")}>
      <ChromeLogo site={ctx.site} className={large ? "size-9" : undefined} />
      <span className="truncate">{nameOf(ctx.site)}</span>
    </a>
  )
}

// --- Navbar -----------------------------------------------------------------------------

function menuOf(settings: HeaderSettings, ctx: ChromeContext): NavItem[] {
  const pages = settings.auto_pages ? ctx.navigation.map((page) => ({ id: `page${page.path}`, label: page.title, link: page.path, children: [] })) : []
  return [...pages, ...settings.links.filter((item) => item.label.trim())]
}

function DesktopMenu({ items, ctx, className }: { items: NavItem[]; ctx: ChromeContext; className?: string }) {
  if (items.length === 0) return null
  return (
    <nav aria-label="Menu situs" className={cn("hidden items-center gap-1 md:flex", className)}>
      {items.map((item, index) => {
        const children = item.children.filter((child) => child.label.trim())
        if (children.length > 0) {
          return (
            <DropdownMenu key={index}>
              <DropdownMenuTrigger render={<Button variant="ghost" />}>
                {item.label}
                <ChevronDownIcon data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-fit min-w-44">
                {children.map((child, position) => (
                  <DropdownMenuItem key={position} render={<a href={hrefOf(child.link, ctx)} />}>
                    {child.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
        const active = item.link === ctx.current
        return (
          <a
            key={index}
            href={hrefOf(item.link, ctx)}
            aria-current={active ? "page" : undefined}
            className={cn(buttonVariants({ variant: "ghost" }), active && "bg-muted")}
          >
            {item.label}
          </a>
        )
      })}
    </nav>
  )
}

function MobileMenu({ items, cta, ctx, always }: { items: NavItem[]; cta: SiteLink; ctx: ChromeContext; always: boolean }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0 && !cta.label.trim()) return null
  const trigger = (
    <Button variant="ghost" size="icon" aria-label="Buka menu" className={always ? "" : "md:hidden"}>
      <MenuIcon />
    </Button>
  )
  // Di editor ikon menu hanya tampil; panel geser tidak dibuka.
  if (ctx.editing) return trigger
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger} />
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{nameOf(ctx.site)}</SheetTitle>
        </SheetHeader>
        <nav aria-label="Menu situs" className="flex flex-col gap-1 px-4">
          {items.map((item, index) => (
            <div key={index} className="flex flex-col">
              <a href={hrefOf(item.link, ctx)} className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted">
                {item.label}
              </a>
              {item.children
                .filter((child) => child.label.trim())
                .map((child, position) => (
                  <a key={position} href={hrefOf(child.link, ctx)} className="rounded-lg py-2 pr-3 pl-7 text-sm text-muted-foreground hover:bg-muted">
                    {child.label}
                  </a>
                ))}
            </div>
          ))}
          {/* Tombol aksi disembunyikan di navbar layar kecil; di sini tetap ada. */}
          {cta.label.trim() ? (
            <a href={hrefOf(cta.link, ctx)} className={cn(buttonVariants(), "mt-3")}>
              {cta.label}
            </a>
          ) : null}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

function Actions({ settings, items, ctx, alwaysMenu }: { settings: HeaderSettings; items: NavItem[]; ctx: ChromeContext; alwaysMenu: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {settings.cta.label.trim() ? (
        <a href={hrefOf(settings.cta.link, ctx)} className={cn(buttonVariants({ variant: settings.show_login ? "outline" : "default" }), "max-sm:hidden")}>
          {settings.cta.label}
        </a>
      ) : null}
      {settings.show_login ? (
        // /auth/login dilayani server Go: <a>, bukan Link.
        <a href={ctx.editing ? undefined : "/auth/login"} className={cn(buttonVariants())}>
          <LogInIcon data-icon="inline-start" />
          Masuk
        </a>
      ) : null}
      <MobileMenu items={items} cta={settings.cta} ctx={ctx} always={alwaysMenu} />
    </div>
  )
}

const dismissedKey = "banner-ditutup"

/** Banner ditutup pengunjung: tersimpan per peramban, sampai teksnya berganti. */
function readDismissed(text: string): boolean {
  try {
    return window.localStorage.getItem(dismissedKey) === text
  } catch {
    return false
  }
}

function AnnouncementBanner({ banner, ctx }: { banner: Banner; ctx: ChromeContext }) {
  const [closed, setClosed] = useState(() => !ctx.editing && banner.dismissible && readDismissed(banner.text))
  if (!banner.text.trim() || closed) return null
  const message = (
    <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap">
      {banner.icon ? <PageIcon name={banner.icon} className="size-4" /> : null}
      <span className="font-medium">{banner.text}</span>
      {banner.link.trim() ? (
        <a href={hrefOf(banner.link, ctx)} className="inline-flex items-center gap-1 font-semibold underline underline-offset-4">
          {banner.link_label.trim() || "Lihat"}
          <ArrowRightIcon aria-hidden="true" className="size-3.5" />
        </a>
      ) : null}
    </span>
  )
  return (
    <ChromeScope look={banner.background} className={cn("relative text-sm", banner.background.border && "border-b")}>
      {banner.moving ? (
        // Teks berjalan: pesannya diulang supaya pita tidak pernah kosong.
        <Marquee seconds={28} className="py-2 [--gap:4rem]">
          {[0, 1, 2].map((copy) => (
            <span key={copy} aria-hidden={copy > 0 || undefined}>
              {message}
            </span>
          ))}
        </Marquee>
      ) : (
        <div className="mx-auto flex max-w-6xl justify-center px-10 py-2 text-center">{message}</div>
      )}
      {banner.dismissible ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Tutup pengumuman"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          onClick={() => {
            if (ctx.editing) return
            setClosed(true)
            try {
              window.localStorage.setItem(dismissedKey, banner.text)
            } catch {
              // Tidak tersimpan: tertutup sampai halaman dimuat ulang.
            }
          }}
        >
          <XIcon />
        </Button>
      ) : null}
    </ChromeScope>
  )
}

export function SiteHeader({ settings, ctx }: { settings: HeaderSettings; ctx: ChromeContext }) {
  const items = menuOf(settings, ctx)
  const variant = settings.variant
  const floating = variant === "floating"

  const announcement = <AnnouncementBanner banner={settings.announcement} ctx={ctx} />

  let bar: ReactNode
  if (variant === "centered") {
    bar = (
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6">
        <Brand ctx={ctx} />
        <DesktopMenu items={items} ctx={ctx} />
        <div className="flex justify-end">
          <Actions settings={settings} items={items} ctx={ctx} alwaysMenu={false} />
        </div>
      </div>
    )
  } else if (variant === "stacked") {
    bar = (
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative flex h-16 items-center justify-between gap-4 md:justify-center">
          <Brand ctx={ctx} large />
          <div className="md:absolute md:right-0">
            <Actions settings={settings} items={items} ctx={ctx} alwaysMenu={false} />
          </div>
        </div>
        {items.length > 0 ? (
          <div className="hidden h-12 items-center justify-center border-t md:flex">
            <DesktopMenu items={items} ctx={ctx} />
          </div>
        ) : null}
      </div>
    )
  } else {
    // Klasik, mengambang, dan minimal: merek di kiri, aksi di kanan.
    bar = (
      <div className={cn("mx-auto flex h-16 items-center gap-6", floating ? "max-w-5xl px-3 sm:px-4" : "max-w-6xl px-4 sm:px-6")}>
        <Brand ctx={ctx} />
        {variant === "minimal" ? null : <DesktopMenu items={items} ctx={ctx} />}
        <div className="ml-auto">
          <Actions settings={settings} items={items} ctx={ctx} alwaysMenu={variant === "minimal"} />
        </div>
      </div>
    )
  }

  if (floating) {
    return (
      <div className={cn("z-40", settings.sticky ? "sticky top-0" : "relative")}>
        {announcement}
        <div className="px-3 pt-3">
          <ChromeScope look={settings.background} className={cn("mx-auto max-w-5xl rounded-full shadow-sm", settings.background.border && "border")}>
            {bar}
          </ChromeScope>
        </div>
      </div>
    )
  }
  return (
    <header className={cn("z-40", settings.sticky ? "sticky top-0" : "relative")}>
      {announcement}
      <ChromeScope look={settings.background} className={cn(settings.background.border && "border-b")}>
        {bar}
      </ChromeScope>
    </header>
  )
}

// --- Kaki situs -------------------------------------------------------------------------

function LinkColumn({ title, links, ctx }: { title: string; links: SiteLink[]; ctx: ChromeContext }) {
  const filled = links.filter((link) => link.label.trim())
  if (filled.length === 0) return null
  return (
    <nav aria-label={title || "Tautan"} className="flex min-w-36 flex-col gap-2 text-sm">
      {title ? <p className="font-semibold">{title}</p> : null}
      {filled.map((link, index) => (
        <a key={index} href={hrefOf(link.link, ctx)} className="text-muted-foreground hover:text-foreground">
          {link.label}
        </a>
      ))}
    </nav>
  )
}

function ContactColumn({ ctx }: { ctx: ChromeContext }) {
  const { contact } = ctx.site
  const place = [contact.address, contact.city].filter(Boolean).join(", ")
  if (!place && !contact.phone && !contact.email && !contact.hours) return null
  const phone = phoneHref(contact.phone)
  const email = emailHref(contact.email)
  return (
    <div className="flex min-w-44 flex-col gap-2 text-sm">
      <p className="font-semibold">Kontak</p>
      {place ? <p className="text-muted-foreground">{place}</p> : null}
      {contact.phone ? (
        <a href={ctx.editing ? undefined : phone} className="text-muted-foreground hover:text-foreground">
          {contact.phone}
        </a>
      ) : null}
      {contact.email ? (
        <a href={ctx.editing ? undefined : email} className="text-muted-foreground hover:text-foreground">
          {contact.email}
        </a>
      ) : null}
      {contact.hours ? <p className="text-muted-foreground">{contact.hours}</p> : null}
    </div>
  )
}

function Channels({ ctx, className }: { ctx: ChromeContext; className?: string }) {
  const channels = channelLinks(ctx.site.channels)
  if (channels.length === 0) return null
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {channels.map((channel) => (
        <a
          key={channel.label}
          href={ctx.editing ? undefined : channel.href}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {channel.label}
        </a>
      ))}
    </div>
  )
}

function BottomBar({ settings, ctx, centered }: { settings: FooterSettings; ctx: ChromeContext; centered?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground",
        centered ? "items-center text-center" : "sm:flex-row sm:items-center sm:justify-between"
      )}
    >
      {settings.copyright.trim() ? <p>{settings.copyright}</p> : <Copyright holder={nameOf(ctx.site)} className="p-0" />}
      <p>Aplikasi {product.name} berjalan di GONSU One</p>
    </div>
  )
}

export function SiteFooter({ settings, ctx }: { settings: FooterSettings; ctx: ChromeContext }) {
  const pages: SiteLink[] = settings.show_pages ? ctx.navigation.map((page) => ({ id: `page${page.path}`, label: page.title, link: page.path })) : []
  const tagline = settings.show_tagline ? ctx.site.tagline : ""
  const variant = settings.variant

  if (variant === "simple" || variant === "centered") {
    const centered = variant === "centered"
    const inline = [...pages, ...settings.columns.flatMap((column) => column.links)].filter((link) => link.label.trim())
    return (
      <ChromeScope look={settings.background} className={cn(settings.background.border && "border-t")}>
        <footer className={cn("mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6", centered && "items-center text-center")}>
          <div className={cn("flex flex-col gap-6", centered ? "items-center" : "md:flex-row md:items-center md:justify-between")}>
            <div className={cn("flex flex-col gap-2", centered && "items-center")}>
              <Brand ctx={ctx} large={centered} />
              {tagline ? <p className="max-w-sm text-sm text-muted-foreground">{tagline}</p> : null}
            </div>
            {inline.length > 0 ? (
              <nav aria-label="Tautan" className={cn("flex flex-wrap gap-x-6 gap-y-2 text-sm", centered && "justify-center")}>
                {inline.map((link, index) => (
                  <a key={index} href={hrefOf(link.link, ctx)} className="text-muted-foreground hover:text-foreground">
                    {link.label}
                  </a>
                ))}
              </nav>
            ) : null}
            {settings.show_channels ? <Channels ctx={ctx} className={centered ? "justify-center" : ""} /> : null}
          </div>
          <BottomBar settings={settings} ctx={ctx} centered={centered} />
        </footer>
      </ChromeScope>
    )
  }

  // Berkolom dan besar.
  const big = variant === "big"
  return (
    <ChromeScope look={settings.background} className={cn("overflow-hidden", settings.background.border && "border-t")}>
      <footer className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6">
        {big && settings.cta.title.trim() ? (
          <ColorScope background="primary" className="flex flex-col items-center gap-5 rounded-3xl px-6 py-12 text-center">
            <p className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{settings.cta.title}</p>
            {settings.cta.label.trim() ? (
              <a href={hrefOf(settings.cta.link, ctx)} className={cn(buttonVariants())}>
                {settings.cta.label}
              </a>
            ) : null}
          </ColorScope>
        ) : null}
        <div className="flex flex-wrap gap-x-16 gap-y-10">
          <div className="flex basis-full flex-col gap-3 md:basis-64">
            <Brand ctx={ctx} />
            {tagline ? <p className="text-sm text-muted-foreground">{tagline}</p> : null}
            {settings.show_channels ? <Channels ctx={ctx} className="mt-1" /> : null}
          </div>
          {settings.show_contact ? <ContactColumn ctx={ctx} /> : null}
          {pages.length > 0 ? <LinkColumn title="Halaman" links={pages} ctx={ctx} /> : null}
          {settings.columns.map((column, index) => (
            <LinkColumn key={index} title={column.title} links={column.links} ctx={ctx} />
          ))}
        </div>
        {big ? (
          // Nama bisnis sebagai tanda besar di dasar kaki situs (gaya Launch UI); hiasan saja.
          <p aria-hidden="true" className="-mb-6 text-center text-[clamp(3rem,15vw,11rem)] leading-none font-semibold tracking-tighter text-foreground/8 select-none">
            {nameOf(ctx.site)}
          </p>
        ) : null}
        <BottomBar settings={settings} ctx={ctx} />
      </footer>
    </ChromeScope>
  )
}
