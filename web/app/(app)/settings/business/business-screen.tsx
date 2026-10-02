"use client"

import { businessTypeLabel, type BusinessProfile } from "@/lib/business-profile"
import { Permission } from "@/lib/permissions"
import { ApiFailure } from "@/components/api-failure"
import { PageLoading } from "@/components/app-shell/page-loading"
import { useBusinessProfile } from "@/components/business-profile-context"
import { PageHeader } from "@/components/page-header"
import { useCan } from "@/components/session-provider"
import { Badge } from "@/components/reui/badge"
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame"
import { BusinessForm } from "./business-form"
import { BusinessLogo } from "./logo-field"

/**
 * Profil bisnis: identitas tenant di aplikasi ini. Modulnya standar GONSU
 * (library gonsu-appkit-go) — isiannya sama di setiap produk.
 *
 * Setiap role boleh membacanya; yang mengubah butuh izin
 * `settings.business.manage`, dan server yang menegakkannya.
 */
export function BusinessScreen() {
  const can = useCan()
  const canManage = can(Permission.SettingsBusinessManage)
  // Data yang sama dengan sidebar: menyimpan di sini langsung mengubahnya.
  const { profile: data, error, loading, reload } = useBusinessProfile()

  return (
    <>
      <PageHeader
        title="Profil bisnis"
        description="Identitas bisnis Anda di aplikasi ini: nama, kontak, alamat, dan logo."
        badge={data && !data.display_name ? <Badge variant="warning-light">Belum diisi</Badge> : null}
      />
      {error ? <ApiFailure error={error} onRetry={reload} /> : null}
      {loading && !data ? (
        <PageLoading label="Memuat profil bisnis…" />
      ) : data ? (
        canManage ? (
          // Dipasang ulang setiap profil TERSIMPAN (version naik): isian
          // menampilkan yang disimpan server (NPWP tanpa pemisah, kode pos
          // dari desa terpilih). Mengganti logo tidak menaikkan version, jadi
          // isian yang belum disimpan tidak hilang karenanya.
          <BusinessForm key={data.version} profile={data} onChanged={reload} />
        ) : (
          <BusinessDetails profile={data} />
        )
      ) : null}
    </>
  )
}

/** Tampilan baca untuk role yang tidak mengurus profil bisnis. */
function BusinessDetails({ profile }: { profile: BusinessProfile }) {
  const rows: { label: string; value: string }[] = [
    { label: "Bidang usaha", value: profile.industry },
    { label: "Email", value: profile.email },
    { label: "Telepon", value: profile.phone },
    { label: "Jenis usaha", value: profile.business_type ? businessTypeLabel[profile.business_type] : "" },
    { label: "Nama legal", value: profile.legal_name },
    { label: "Alamat", value: profile.address_text },
  ]

  return (
    <Frame className="w-full max-w-3xl">
      <FrameHeader>
        <FrameTitle>{profile.display_name || "Profil bisnis belum diisi"}</FrameTitle>
        <FrameDescription>Profil ini diisi administrator. Role Anda hanya bisa melihatnya.</FrameDescription>
      </FrameHeader>
      <FramePanel className="flex flex-col gap-5">
        <BusinessLogo profile={profile} />
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[12rem_1fr]">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd>{row.value || "—"}</dd>
            </div>
          ))}
        </dl>
      </FramePanel>
    </Frame>
  )
}
