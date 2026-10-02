"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRightIcon, Building2Icon, LogInIcon, MapPinIcon, MenuIcon, type LucideIcon } from "lucide-react"
import { cn } from "cn"

import { site } from "@/lib/site"
import { IconTile } from "@/components/reui/icon-tile"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

import { SiteLogo, SitePhoto } from "./decor"

interface MenuEntry {
  href: string
  title: string
  description: string
  icon: LucideIcon
}

// Menu hanya menunjuk bagian yang ADA di halaman ini, ditambah pintu masuk
// aplikasi. Tautan ke halaman yang belum dibuat hanya berujung 404; tenant
// yang menambah halaman (karier, berita) menambah barisnya di sini.
const companyMenu: MenuEntry[] = [
  { href: "#tentang", title: "Tentang kami", description: "Cerita dan nilai yang kami pegang.", icon: Building2Icon },
  { href: "#kontak", title: "Kontak & lokasi", description: "Alamat, telepon, email, dan jam kerja.", icon: MapPinIcon },
  { href: "/auth/login", title: "Area pengguna", description: "Masuk ke aplikasi dengan akun GONSU.", icon: LogInIcon },
]

const sectionLinks = [
  { href: "#tentang", title: "Tentang kami" },
  { href: "#layanan", title: "Layanan" },
  { href: "#kontak", title: "Kontak" },
]

/**
 * Kepala halaman depan: nama tenant, mega menu, dan tombol Masuk.
 *
 * Masuk memakai <a>, bukan Link: /auth/login dilayani server Go lalu
 * diarahkan ke GONSU, jadi harus navigasi penuh.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 font-semibold tracking-tight">
          <SiteLogo />
          <span className="truncate">{site.name}</span>
        </Link>
        <DesktopMenu />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <a href="/auth/login" className={cn(buttonVariants())}>
            <LogInIcon data-icon="inline-start" />
            Masuk
          </a>
          <MobileMenu />
        </div>
      </div>
    </header>
  )
}

function DesktopMenu() {
  return (
    <NavigationMenu className="hidden lg:flex">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Perusahaan</NavigationMenuTrigger>
          <NavigationMenuContent className="w-190 p-0">
            <div className="flex gap-2 p-2">
              <ul className="flex flex-1 flex-col gap-0.5">
                {companyMenu.map((entry) => (
                  <li key={entry.href}>
                    <MenuLink {...entry} />
                  </li>
                ))}
              </ul>
              <NavigationMenuLink
                href="#kontak"
                closeOnClick
                className="w-60 shrink-0 flex-col items-stretch gap-0 bg-muted p-1.5 hover:bg-muted focus:bg-muted"
              >
                <SitePhoto label="Foto kantor" className="h-28 rounded-md border bg-card" />
                <span className="flex flex-col gap-1 p-2.5">
                  <span className="font-medium">Kantor kami</span>
                  <span className="text-muted-foreground">{site.contact.address}</span>
                  <span className="mt-1.5 inline-flex items-center gap-1 font-medium text-primary dark:text-primary-foreground">
                    Petunjuk arah
                    <ArrowRightIcon aria-hidden="true" />
                  </span>
                </span>
              </NavigationMenuLink>
            </div>
            <MenuFooter note={`Karyawan atau pengguna aplikasi ${site.name}?`} href="/auth/login" label="Masuk ke aplikasi" />
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Layanan</NavigationMenuTrigger>
          <NavigationMenuContent className="w-160 p-0">
            <ul className="grid grid-cols-2 gap-0.5 p-2">
              {site.services.map((service) => (
                <li key={service.title}>
                  <MenuLink href="#layanan" {...service} />
                </li>
              ))}
            </ul>
            <MenuFooter note="Butuh sesuatu yang tidak ada di daftar?" href="#kontak" label="Hubungi kami" />
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="#kontak" className={navigationMenuTriggerStyle()}>
            Kontak
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}

function MenuLink({ href, title, description, icon: Icon }: MenuEntry) {
  return (
    <NavigationMenuLink href={href} closeOnClick className="items-start gap-3 p-3">
      <IconTile aria-hidden="true">
        <Icon />
      </IconTile>
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">{title}</span>
        <span className="leading-snug text-muted-foreground">{description}</span>
      </span>
    </NavigationMenuLink>
  )
}

function MenuFooter({ note, href, label }: { note: string; href: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t bg-muted/50 px-5 py-3 text-sm">
      <span className="text-muted-foreground">{note}</span>
      <NavigationMenuLink
        href={href}
        closeOnClick
        className="shrink-0 p-0 font-medium text-primary hover:bg-transparent focus:bg-transparent dark:text-primary-foreground"
      >
        {label}
        <ArrowRightIcon aria-hidden="true" />
      </NavigationMenuLink>
    </div>
  )
}

/** Di bawah lg, mega menu diganti Sheet berisi bagian-bagian halaman. */
function MobileMenu() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Buka menu" className="lg:hidden" />}>
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{site.name}</SheetTitle>
        </SheetHeader>
        <nav aria-label="Bagian halaman" className="flex flex-col gap-1 px-4">
          {sectionLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted"
            >
              {link.title}
            </a>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
