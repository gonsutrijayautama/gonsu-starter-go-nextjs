"use client"

import { createContext, use, type ReactNode } from "react"
import { cn } from "cn"

import type { NavigationLink, SiteChrome } from "@/lib/pages"
import type { Site } from "@/lib/site"

import { pageVars } from "./blocks"
import { PageMotion } from "./motion"
import { SiteFooter, SiteHeader, type ChromeContext } from "./site-chrome"

// Navbar dan kaki situs di kanvas editor. Root halaman (config.tsx) merender
// keduanya di atas dan di bawah isi bila konteks ini ada, yaitu di editor;
// halaman publik merendernya sendiri (app/situs). Keduanya bukan blok Puck:
// diklik untuk memilih, lalu disunting di panel kanan, dan berlaku untuk
// semua halaman.

export type ChromePart = "header" | "footer"

export type ChromeCanvas = {
  chrome: SiteChrome
  site: Site
  navigation: NavigationLink[]
  current: string
  selected: ChromePart | null
  select: (part: ChromePart) => void
  /** Mode coba: navbar dan kaki situs bisa diklik seperti di halaman terbit. */
  trying: boolean
}

export const ChromeCanvasContext = createContext<ChromeCanvas | null>(null)

const labels: Record<ChromePart, string> = { header: "Navbar", footer: "Kaki situs" }

function Region({ part, canvas, children }: { part: ChromePart; canvas: ChromeCanvas; children: ReactNode }) {
  if (canvas.trying) return <>{children}</>
  const selected = canvas.selected === part
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Sunting ${labels[part].toLowerCase()} (berlaku untuk semua halaman)`}
      aria-pressed={selected}
      onClick={() => canvas.select(part)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault()
        canvas.select(part)
      }}
      className={cn(
        "group/chrome relative cursor-pointer outline-2 -outline-offset-2 outline-transparent transition-[outline-color] hover:outline-ring",
        selected && "outline-primary hover:outline-primary"
      )}
    >
      {/* Isi navbar tidak menerima klik di editor: klik memilih navbarnya. */}
      <div className="pointer-events-none">{children}</div>
      <span
        className={cn(
          "pointer-events-none absolute right-2 z-50 rounded-md bg-invert px-2 py-0.5 text-xs text-invert-foreground opacity-0 transition-opacity group-hover/chrome:opacity-100",
          part === "header" ? "bottom-1" : "top-2",
          selected && "opacity-100"
        )}
      >
        {labels[part]} · berlaku untuk semua halaman
      </span>
    </div>
  )
}

/** Root halaman: isi blok, dan di editor juga navbar dan kaki situs. */
export function PageRoot({ children }: { children: ReactNode }) {
  const canvas = use(ChromeCanvasContext)
  // MotionConfig: animasi menghormati "kurangi gerakan" di perangkat pengunjung.
  const body = (
    <PageMotion>
      <div className={cn("flex flex-col bg-background text-foreground", pageVars)}>{children}</div>
    </PageMotion>
  )
  if (!canvas) return body
  const ctx: ChromeContext = {
    site: canvas.site,
    navigation: canvas.navigation,
    current: canvas.current,
    linkFor: () => "#",
    editing: !canvas.trying,
  }
  return (
    <div className="flex min-h-full flex-col bg-background text-foreground">
      <Region part="header" canvas={canvas}>
        <SiteHeader settings={canvas.chrome.header} ctx={ctx} />
      </Region>
      <div className="flex-1">{body}</div>
      <Region part="footer" canvas={canvas}>
        <SiteFooter settings={canvas.chrome.footer} ctx={ctx} />
      </Region>
    </div>
  )
}
