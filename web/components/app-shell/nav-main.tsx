"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRightIcon } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

import { isNavItemActive } from "./navigation"

export interface NavSubItem {
  title: string
  url: string
}

export interface NavItem {
  title: string
  url: string
  icon?: React.ReactNode
  /**
   * Hanya menyala pada alamatnya sendiri, tidak pada halaman turunannya. Wajib
   * untuk beranda yang alamatnya awalan menu lain.
   */
  exact?: boolean
  /** Untuk item bersub-menu: terbuka sejak awal walau belum ada yang aktif. */
  isActive?: boolean
  /**
   * Bila diisi, item menjadi menu yang dapat dibuka-tutup (bentuk sidebar-07).
   * Bila tidak, item adalah tautan biasa yang menyala pada halamannya.
   */
  items?: NavSubItem[]
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

/** Menu utama sidebar: satu `SidebarGroup` per grup. */
export function NavMain({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname()

  return (
    <>
      {groups.map((group, index) => (
        <SidebarGroup key={group.label ?? `group-${index}`}>
          {group.label ? <SidebarGroupLabel>{group.label}</SidebarGroupLabel> : null}
          <SidebarMenu className="space-y-0.5">
            {group.items.map((item) =>
              item.items?.length ? (
                <Collapsible
                  key={item.title}
                  // Terbuka sendiri bila halaman yang dibuka ada di dalamnya;
                  // sub-menu aktif yang tersembunyi di balik grup tertutup
                  // sama saja dengan tidak ada yang menyala.
                  defaultOpen={
                    item.isActive ||
                    item.items.some((sub) => isNavItemActive(sub.url, pathname))
                  }
                  className="group/collapsible"
                  render={<SidebarMenuItem />}
                >
                  <CollapsibleTrigger
                    render={<SidebarMenuButton tooltip={item.title} />}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                    <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items.map((sub) => (
                        <SidebarMenuSubItem key={sub.title}>
                          <SidebarMenuSubButton
                            isActive={isNavItemActive(sub.url, pathname)}
                            render={<Link href={sub.url} />}
                          >
                            <span>{sub.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              ) : (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={isNavItemActive(item.url, pathname, item.exact)}
                    tooltip={item.title}
                    // `render` menerima elemen TANPA children; children-nya
                    // jadi JSX children di sini (docs/ui-guide.md) — kalau tidak,
                    // server merender <a> sementara client merender <button>.
                    render={<Link href={item.url} />}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ),
            )}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  )
}
