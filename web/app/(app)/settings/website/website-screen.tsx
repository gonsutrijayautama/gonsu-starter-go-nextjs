"use client"

import { ArrowUpRightIcon } from "lucide-react"
import { cn } from "cn"

import { useResource } from "@/hooks/use-resource"
import { Permission } from "@/lib/permissions"
import { websitePath, type WebsiteSettings } from "@/lib/website"
import { ApiFailure } from "@/components/api-failure"
import { PageLoading } from "@/components/app-shell/page-loading"
import { PageHeader } from "@/components/page-header"
import { useCan } from "@/components/session-provider"
import { Badge } from "@/components/reui/badge"
import { buttonVariants } from "@/components/ui/button"
import { WebsiteForm } from "./website-form"

/**
 * Pengaturan halaman depan publik. Modulnya standar GONSU (library
 * gonsu-appkit-go) — isiannya sama di setiap produk.
 *
 * Identitas (nama, logo, kontak, alamat) diisi di Profil bisnis; di sini
 * hanya yang khas halaman depan. Yang mengubah butuh izin
 * `settings.website.manage`, dan server yang menegakkannya.
 */
export function WebsiteScreen() {
  const can = useCan()
  const canManage = can(Permission.SettingsWebsiteManage)
  const { data, error, loading, reload } = useResource<WebsiteSettings>(websitePath)

  return (
    <>
      <PageHeader
        title="Website"
        description="Halaman depan di alamat aplikasi ini: yang dilihat pengunjung sebelum masuk."
        badge={
          data ? (
            data.mode === "site" ? (
              <Badge variant="success-light">Web perusahaan</Badge>
            ) : (
              <Badge variant="info-light">Hanya pintu masuk</Badge>
            )
          ) : null
        }
        action={
          // "/" disajikan server Go dengan data bisnis disisipkan: navigasi
          // penuh di tab baru, jadi <a>, bukan Link.
          <a href="/" target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline" }))}>
            Lihat halaman depan
            <ArrowUpRightIcon data-icon="inline-end" />
          </a>
        }
      />
      {!canManage ? (
        <p className="text-sm text-muted-foreground">Role Anda belum bisa mengatur website.</p>
      ) : (
        <>
          {error ? <ApiFailure error={error} onRetry={reload} /> : null}
          {loading && !data ? (
            <PageLoading label="Memuat pengaturan website…" />
          ) : data ? (
            // Dipasang ulang setiap pengaturan TERSIMPAN (version naik).
            // Mengganti gambar tidak menaikkan version, jadi isian yang belum
            // disimpan tidak hilang karenanya.
            <WebsiteForm key={data.version} settings={data} onChanged={reload} />
          ) : null}
        </>
      )}
    </>
  )
}
