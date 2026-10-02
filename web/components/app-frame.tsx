"use client"

import { breadcrumbLabels, pages, visibleSections } from "@/lib/navigation"
import { portalLinks } from "@/lib/portal"
import { product } from "@/lib/product"
import { roleLabel } from "@/lib/roles"
import { AppBreadcrumb } from "@/components/app-shell/app-breadcrumb"
import { AppShell } from "@/components/app-shell/app-shell"
import { Copyright } from "@/components/app-shell/copyright"
import { ProductBrand } from "@/components/app-shell/product-brand"
import { useBusinessProfile } from "@/components/business-profile-context"
import { UserMenu } from "@/components/app-shell/user-menu"
import { LicenseBanner } from "@/components/license-banner"
import { useCan, usePortal, useSession } from "@/components/session-provider"

/**
 * Kerangka yang diisi data sesi: menu menurut izin, menu akun, dan tombol
 * pengaturan yang menuju menu Pengaturan pertama yang boleh dibuka.
 */
export function AppFrame({ children }: { children: React.ReactNode }) {
  const me = useSession()
  const can = useCan()
  const portal = usePortal()
  const { profile } = useBusinessProfile()
  const sections = visibleSections(can)
  const settings = sections.find((section) => section.id === "settings")
  const settingsHref = settings?.groups[0]?.items[0]?.url

  return (
    <AppShell
      brand={
        <ProductBrand
          code={product.code}
          name={product.name}
          business={profile ? { name: profile.display_name, logoUrl: profile.logo?.url } : undefined}
        />
      }
      sections={sections}
      sidebarFooter={<Copyright holder={product.name} />}
      breadcrumb={<AppBreadcrumb labels={breadcrumbLabels} pages={pages} />}
      settingsHref={settingsHref}
      userMenu={
        <UserMenu
          name={me.name}
          email={me.email}
          role={roleLabel[me.role]}
          accountUrl={me.auth_kind === "GONSU" ? "/auth/gonsu/account" : undefined}
          subscriptionUrl={portal ? portalLinks.subscription : undefined}
        />
      }
      notice={<LicenseBanner />}
    >
      {children}
    </AppShell>
  )
}
