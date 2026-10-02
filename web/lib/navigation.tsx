import { Building2Icon, KeyRoundIcon, LayoutDashboardIcon, NotebookPenIcon, UsersIcon } from "lucide-react"

import type { AppSidebarSection } from "@/components/app-shell/app-sidebar"
import type { NavItem } from "@/components/app-shell/nav-main"
import { Permission } from "@/lib/permissions"

export type AppNavItem = NavItem & {
  /** Menu disembunyikan dari pengguna tanpa izin ini; server tetap yang menolak. */
  permission?: Permission
  /** Keterangan singkat untuk kartu di dasbor. Tanpa keterangan, tidak jadi kartu. */
  description?: string
}

type AppSection = { id: string; label: string; groups: { label?: string; items: AppNavItem[] }[] }

// Menu sidebar. Section pertama adalah beranda; Pengaturan dibuka dari tombol
// di header dan membawa "← Kembali ke Dasbor". Modul baru menambah barisnya di
// sini. url berakhiran "/" karena static export menulis <path>/index.html.
export const sections: AppSection[] = [
  {
    id: "main",
    label: "Utama",
    groups: [
      {
        items: [
          { title: "Dasbor", url: "/dashboard/", icon: <LayoutDashboardIcon /> },
          {
            title: "Catatan",
            url: "/notes/",
            icon: <NotebookPenIcon />,
            permission: Permission.NotesRead,
            description: "Catatan bersama untuk tim.",
          },
        ],
      },
    ],
  },
  {
    id: "settings",
    label: "Pengaturan",
    groups: [
      {
        label: "Bisnis",
        items: [
          {
            // Tanpa `permission`: setiap role boleh melihat profil bisnisnya.
            // Yang mengubah butuh settings.business.manage, dijaga server.
            title: "Profil bisnis",
            url: "/settings/business/",
            icon: <Building2Icon />,
            description: "Nama, kontak, alamat, dan logo bisnis Anda.",
          },
        ],
      },
      {
        label: "Akses",
        items: [
          {
            title: "Pengguna & Akses",
            url: "/settings/users/",
            icon: <UsersIcon />,
            permission: Permission.SettingsUsersManage,
            description: "Beri akses login ke karyawan dan atur role-nya.",
          },
        ],
      },
      {
        label: "Aplikasi",
        items: [
          {
            title: "Lisensi",
            url: "/settings/license/",
            icon: <KeyRoundIcon />,
            description: "Paket, masa berlaku, dan versi aplikasi.",
          },
        ],
      },
    ],
  },
]

/** Nama setiap segmen alamat di breadcrumb. */
export const breadcrumbLabels: Record<string, string> = {
  dashboard: "Dasbor",
  notes: "Catatan",
  settings: "Pengaturan",
  business: "Profil bisnis",
  users: "Pengguna & Akses",
  license: "Lisensi",
}

/** Section dan menu yang boleh dilihat pengguna ini; grup kosong dibuang. */
export function visibleSections(can: (permission: Permission) => boolean): AppSidebarSection[] {
  return sections
    .map((section) => ({
      ...section,
      groups: section.groups
        .map((group) => ({ ...group, items: group.items.filter((item) => !item.permission || can(item.permission)) }))
        .filter((group) => group.items.length > 0),
    }))
    .filter((section) => section.groups.length > 0)
}

/** Seluruh alamat halaman, untuk breadcrumb. */
export const pages: string[] = sections.flatMap((s) => s.groups.flatMap((g) => g.items.map((i) => i.url)))
