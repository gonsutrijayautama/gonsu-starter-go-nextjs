import Link from "next/link"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

import { BusinessAvatar, initials } from "./generated-avatar"

export interface ProductBrandProps {
  code: string
  name: string
  /**
   * Bisnis yang memakai aplikasi ini. Bila namanya sudah diisi, DIALAH yang
   * tampil di kepala sidebar, dengan nama produk di bawahnya: orang membuka
   * aplikasi untuk bisnisnya, bukan untuk produknya.
   */
  business?: { name: string; logoUrl?: string }
}

/**
 * Identitas di kepala sidebar: logo dan nama bisnis di atas nama produk, atau
 * nama produk saja selama profil bisnis belum diisi.
 *
 * `SidebarMenuButton size="lg"`, bukan div sendiri: ia sudah membawa
 * penataan yang membuat logo sejajar dengan ikon menu di bawahnya.
 */
export function ProductBrand({ code, name, business }: ProductBrandProps) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" render={<Link href="/dashboard/" />}>
          {business?.name ? (
            <>
              <Avatar className="size-8 rounded-md after:rounded-md after:border-0">
                {business.logoUrl ? (
                  <AvatarImage src={business.logoUrl} alt="" className="rounded-[inherit] object-contain" />
                ) : null}
                <AvatarFallback className="rounded-[inherit] text-xs">{initials(business.name)}</AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate font-semibold">{business.name}</span>
                <span className="truncate text-xs text-muted-foreground">{name}</span>
              </span>
            </>
          ) : (
            <>
              <BusinessAvatar seed={code} name={name} className="size-8" />
              <span className="truncate font-semibold">{name}</span>
            </>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
