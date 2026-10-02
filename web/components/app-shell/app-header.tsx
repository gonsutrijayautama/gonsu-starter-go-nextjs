import Link from "next/link"
import { SettingsIcon } from "lucide-react"
import { cn } from "cn"

import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

import { ThemeToggle } from "./theme-toggle"

export interface AppHeaderProps {
  breadcrumb?: React.ReactNode
  /** Bila diisi, tampil ikon pengaturan yang menuju alamat ini. */
  settingsHref?: string
  userMenu?: React.ReactNode
}

/**
 * Header: breadcrumb di kiri; tema, pengaturan, dan akun di kanan — urutan
 * yang dipatok di sini supaya sama di setiap halaman.
 *
 * `sticky`, bukan `fixed`: header tinggal di dalam SidebarInset, jadi sticky
 * otomatis selebar area konten. Latarnya `bg-sidebar` supaya konten yang
 * di-scroll tidak terlihat menembus header. `min-h-16`, bukan `h-16`: di ponsel
 * breadcrumb panjang terlipat, dan tinggi yang dipatok membuat lipatannya
 * menimpa judul halaman.
 */
export function AppHeader({ breadcrumb, settingsHref, userMenu }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex min-h-16 shrink-0 items-center gap-2 bg-sidebar/80 py-2 backdrop-blur print:hidden">
      <div className="flex min-w-0 flex-1 items-center gap-2 px-4">
        {/* Sidebar desktop dikunci terbuka; trigger hanya untuk Sheet di mobile. */}
        <SidebarTrigger className="-ml-1 md:hidden" />
        <Separator
          orientation="vertical"
          className="mr-2 data-vertical:h-4 data-vertical:self-auto md:hidden"
        />
        {breadcrumb}
      </div>

      <div className="flex items-center gap-1 px-4">
        <ThemeToggle />
        {settingsHref !== undefined ? (
          // Tautan bergaya tombol: <Link> + buttonVariants, BUKAN Button
          // (docs/ui-guide.md). cn() wajib supaya kelas tambahan menang.
          <Link href={settingsHref} aria-label="Pengaturan" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
            <SettingsIcon />
          </Link>
        ) : null}
        {userMenu}
      </div>
    </header>
  )
}
