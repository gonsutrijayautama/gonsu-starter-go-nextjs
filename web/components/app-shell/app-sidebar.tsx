"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

import { NavMain, type NavGroup } from "./nav-main"
import { sectionForPath } from "./navigation"

/**
 * Satu daftar menu sidebar, misalnya Utama atau Pengaturan. Yang pertama
 * adalah beranda aplikasi; bagian lain dibuka dari tempat lain — Pengaturan
 * dari tombol di header.
 */
export interface AppSidebarSection {
  id: string
  label: string
  groups: NavGroup[]
}

export interface AppSidebarProps {
  brand: React.ReactNode
  sections: AppSidebarSection[]
  footer?: React.ReactNode
}

export function AppSidebar({ brand, sections, footer }: AppSidebarProps) {
  const pathname = usePathname()

  const sectionUrls = sections.map((section) => ({
    id: section.id,
    links: section.groups.flatMap((group) =>
      group.items.flatMap((item) => [
        { url: item.url, exact: item.exact },
        ...(item.items?.map((sub) => ({ url: sub.url })) ?? []),
      ]),
    ),
  }))

  // Bagian yang tampil mengikuti halaman yang dibuka — tanpa tab. Berpindah
  // bagian berarti berpindah halaman: ke Pengaturan lewat tombol di header,
  // kembali lewat tautan di atas menu.
  const sectionId = sectionForPath(pathname, sectionUrls)
  const section = sections.find((candidate) => candidate.id === sectionId) ?? sections[0]
  const home = sections[0]
  const homeItem = home?.groups[0]?.items[0]

  return (
    <Sidebar className="border-r-0!">
      <SidebarHeader>{brand}</SidebarHeader>
      <SidebarContent>
        {section && section !== home && homeItem ? (
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={`Kembali ke ${homeItem.title}`}
                  render={<Link href={homeItem.url} />}
                >
                  <ArrowLeftIcon />
                  <span>Kembali ke {homeItem.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        ) : null}
        {section ? <NavMain groups={section.groups} /> : null}
      </SidebarContent>
      {footer ? <SidebarFooter>{footer}</SidebarFooter> : null}
    </Sidebar>
  )
}
