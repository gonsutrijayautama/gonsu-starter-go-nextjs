import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

import { AppHeader } from "./app-header"
import { AppSidebar, type AppSidebarSection } from "./app-sidebar"

export interface AppShellProps {
  /** Logo dan nama produk di kepala sidebar. */
  brand: React.ReactNode
  /**
   * Daftar menu sidebar. Yang tampil adalah section yang memuat halaman yang
   * dibuka; section pertama adalah berandanya (lihat AppSidebar).
   */
  sections: AppSidebarSection[]
  /** Kaki sidebar, misalnya `Copyright`. */
  sidebarFooter?: React.ReactNode
  breadcrumb?: React.ReactNode
  /** Bila diisi, header menampilkan ikon pengaturan yang menuju alamat ini. */
  settingsHref?: string
  /** Menu akun di kanan atas. */
  userMenu?: React.ReactNode
  /** Di atas isi halaman, misalnya banner lisensi. */
  notice?: React.ReactNode
  children: React.ReactNode
}

/**
 * Kerangka aplikasi: sidebar di kiri, header sticky di atas, konten di
 * bawahnya — bentuk yang sama dengan Console dan Portal GONSU One.
 *
 * Bentuknya dari blok shadcn `sidebar-07`, dengan perbedaan yang disengaja:
 * sidebar desktop tidak dapat diciutkan, dan identitas pengguna ada di kanan
 * atas, bukan di kaki sidebar.
 */
export function AppShell({
  brand,
  sections,
  sidebarFooter,
  breadcrumb,
  settingsHref,
  userMenu,
  notice,
  children,
}: AppShellProps) {
  return (
    // `open` tanpa `onOpenChange` mengunci sidebar desktop tetap terbuka,
    // termasuk terhadap pintasan Ctrl/Cmd+B. Di mobile sidebar berupa Sheet
    // dengan state terpisah, jadi trigger di header tetap dibutuhkan.
    <SidebarProvider
      open
      style={{ "--sidebar-width": "200px", "--sidebar-width-icon": "52px" } as React.CSSProperties}
    >
      <AppSidebar brand={brand} sections={sections} footer={sidebarFooter} />
      <SidebarInset className="bg-sidebar">
        <AppHeader breadcrumb={breadcrumb} settingsHref={settingsHref} userMenu={userMenu} />
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4 pt-0">
          {notice}
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
