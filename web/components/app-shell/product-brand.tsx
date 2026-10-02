import Link from "next/link"

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

import { BusinessAvatar } from "./generated-avatar"

/**
 * Logo dan nama produk di kepala sidebar.
 *
 * `SidebarMenuButton size="lg"`, bukan div sendiri: ia sudah membawa
 * penataan yang membuat logo sejajar dengan ikon menu di bawahnya.
 */
export function ProductBrand({ code, name }: { code: string; name: string }) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" render={<Link href="/dashboard/" />}>
          <BusinessAvatar seed={code} name={name} className="size-8" />
          <span className="truncate font-semibold">{name}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
