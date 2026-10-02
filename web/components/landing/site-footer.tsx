import { product } from "@/lib/product"
import { site } from "@/lib/site"
import { Copyright } from "@/components/app-shell/copyright"

import { SiteLogo } from "./decor"

const columns = [
  {
    title: "Perusahaan",
    links: [
      { href: "#tentang", label: "Tentang kami" },
      { href: "#layanan", label: "Layanan" },
      { href: "#kontak", label: "Kontak" },
    ],
  },
  {
    // /auth/* dilayani server Go: <a>, bukan Link.
    title: "Pengguna aplikasi",
    links: [
      { href: "/auth/login", label: "Masuk" },
      { href: "/auth/gonsu/forgot-password", label: "Lupa sandi" },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="flex max-w-xs flex-col gap-3">
            <div className="flex items-center gap-2.5 font-semibold tracking-tight">
              <SiteLogo />
              {site.name}
            </div>
            <p className="text-sm text-muted-foreground">{site.tagline}</p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:gap-16">
            {columns.map((column) => (
              <nav key={column.title} aria-label={column.title} className="flex flex-col gap-3 text-sm">
                <p className="font-semibold">{column.title}</p>
                {column.links.map((link) => (
                  <a key={link.href} href={link.href} className="text-muted-foreground hover:text-foreground">
                    {link.label}
                  </a>
                ))}
              </nav>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <Copyright holder={site.name} className="p-0" />
          <p>Aplikasi {product.name} berjalan di GONSU One</p>
        </div>
      </div>
    </footer>
  )
}
