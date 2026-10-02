"use client"

import { cn } from "cn"

import { useResource } from "@/hooks/use-resource"
import { formatDate, formatDateTime } from "@/lib/format"
import type { License, Phase } from "@/lib/license"
import { portalLinks } from "@/lib/portal"
import { product } from "@/lib/product"
import { ApiFailure } from "@/components/api-failure"
import { PageLoading } from "@/components/app-shell/page-loading"
import { PageHeader } from "@/components/page-header"
import { usePortal } from "@/components/session-provider"
import { buttonVariants } from "@/components/ui/button"
import { Badge, type BadgeProps } from "@/components/reui/badge"
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame"

const phaseBadge: Record<Phase, { label: string; variant: BadgeProps["variant"] }> = {
  NORMAL: { label: "Aktif", variant: "success-light" },
  UNLICENSED: { label: "Aktif", variant: "success-light" },
  GRACE: { label: "Masa tenggang", variant: "warning-light" },
  RESTRICTED: { label: "Tidak aktif", variant: "destructive-light" },
  NOT_ACTIVATED: { label: "Belum diaktifkan", variant: "destructive-light" },
  UNREACHABLE: { label: "Belum bisa dicek", variant: "info-light" },
}

const modeLabel: Record<License["mode"], string> = {
  cloud: "Cloud GONSU",
  self_host: "Server sendiri",
}

/**
 * Keadaan lisensi dan versi aplikasi — halaman yang dibuka orang saat banner
 * lisensi muncul, atau saat pengembang bertanya "versi berapa yang terpasang".
 * Semua role boleh membacanya.
 */
export function LicenseScreen() {
  const { data, error, loading, reload } = useResource<License>("/v1/license")
  const portal = usePortal()
  const badge = data ? phaseBadge[data.phase] : undefined

  const rows: { label: string; value: React.ReactNode }[] = data
    ? [
        { label: "Paket", value: data.plan_name || "—" },
        { label: "Dipasang di", value: modeLabel[data.mode] ?? data.mode },
        { label: "Berlaku sampai", value: data.expires_at ? formatDate(data.expires_at) : "—" },
        ...(data.grace_until ? [{ label: "Masa tenggang sampai", value: formatDate(data.grace_until) }] : []),
        { label: "Terakhir dicek", value: data.checked_at ? formatDateTime(data.checked_at) : "—" },
        { label: "Versi aplikasi", value: <span className="font-mono">{product.version}</span> },
      ]
    : []

  return (
    <>
      <PageHeader
        title="Lisensi"
        description="Paket yang dipakai pemasangan ini, dan sampai kapan berlaku."
        badge={badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : null}
        action={
          portal ? (
            // Jalur server (kit GONSU), jadi <a> bergaya tombol, bukan Button.
            <a href={portalLinks.subscription} className={cn(buttonVariants())}>
              Kelola langganan
            </a>
          ) : null
        }
      />
      {error ? <ApiFailure error={error} onRetry={reload} /> : null}
      {loading && !data ? (
        <PageLoading label="Memuat lisensi…" />
      ) : data ? (
        <Frame className="w-full max-w-2xl">
          <FrameHeader>
            <FrameTitle>{product.name}</FrameTitle>
            <FrameDescription>
              {portal ? "Paket, tagihan, dan perpanjangan diatur di Portal GONSU." : "Langganan diatur pemilik bisnis di Portal GONSU."}
            </FrameDescription>
          </FrameHeader>
          <FramePanel>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[12rem_1fr]">
              {rows.map((row) => (
                <div key={row.label} className="contents">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </FramePanel>
        </Frame>
      ) : null}
    </>
  )
}
