"use client"

import { product } from "@/lib/product"
import { Copyright } from "@/components/app-shell/copyright"

import { SiteLogo } from "./decor"
import { sectionLinks } from "./sections"
import { useSite, useSiteName } from "./site-context"

// /auth/* dilayani server Go: <a>, bukan Link.
const userLinks = [
  { href: "/auth/login", title: "Masuk" },
  { href: "/auth/gonsu/forgot-password", title: "Lupa sandi" },
]

export function SiteFooter() {
  const site = useSite()
  const name = useSiteName()
  const columns = [
    { title: "Perusahaan", links: sectionLinks(site) },
    { title: "Pengguna aplikasi", links: userLinks },
  ].filter((column) => column.links.length > 0)

  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="flex max-w-xs flex-col gap-3">
            <div className="flex items-center gap-2.5 font-semibold tracking-tight">
              <SiteLogo />
              {name}
            </div>
            {site.tagline ? <p className="text-sm text-muted-foreground">{site.tagline}</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-10 sm:gap-16">
            {columns.map((column) => (
              <nav key={column.title} aria-label={column.title} className="flex flex-col gap-3 text-sm">
                <p className="font-semibold">{column.title}</p>
                {column.links.map((link) => (
                  <a key={link.href} href={link.href} className="text-muted-foreground hover:text-foreground">
                    {link.title}
                  </a>
                ))}
              </nav>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <Copyright holder={name} className="p-0" />
          <p>Aplikasi {product.name} berjalan di GONSU One</p>
        </div>
      </div>
    </footer>
  )
}
