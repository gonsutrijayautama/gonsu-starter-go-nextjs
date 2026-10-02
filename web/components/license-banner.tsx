"use client"

import { CircleAlertIcon, InfoIcon, TriangleAlertIcon } from "lucide-react"
import { cn } from "cn"

import { useResource } from "@/hooks/use-resource"
import { formatDate } from "@/lib/format"
import type { License } from "@/lib/license"
import { portalLinks } from "@/lib/portal"
import { usePortal } from "@/components/session-provider"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/reui/alert"
import { buttonVariants } from "@/components/ui/button"

/**
 * Keadaan lisensi yang perlu diketahui pengguna (GET /v1/license). Tidak tampil
 * saat lisensi normal. Server tetap yang menolak mutasi saat lisensi tidak
 * aktif; banner ini hanya menjelaskan kenapa.
 */
export function LicenseBanner() {
  const { data } = useResource<License>("/v1/license")
  const portal = usePortal()
  if (!data) return null

  // Tagihan ada di Portal: tampil hanya bagi yang mengurus langganan. Jalur
  // server, jadi <a>, bukan <Link>.
  const payInvoice = portal ? (
    <AlertAction>
      <a href={portalLinks.invoices} className={cn(buttonVariants({ variant: "outline" }))}>
        Bayar tagihan
      </a>
    </AlertAction>
  ) : null

  switch (data.phase) {
    case "GRACE":
      return (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>Langganan perlu diperpanjang</AlertTitle>
          <AlertDescription>
            Aplikasi tetap jalan seperti biasa
            {data.grace_until ? ` sampai ${formatDate(data.grace_until)}` : ""}.{" "}
            {portal
              ? "Bayar tagihannya supaya tidak terhenti."
              : "Minta pemilik bisnis memperpanjang langganan supaya tidak terhenti."}
          </AlertDescription>
          {payInvoice}
        </Alert>
      )
    case "RESTRICTED":
      return (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Lisensi tidak aktif</AlertTitle>
          <AlertDescription>
            Data masih bisa dibuka, tapi belum bisa menambah atau mengubah data.{" "}
            {portal ? "Cek tagihan dan langganannya di Portal." : "Minta pemilik bisnis mengecek langganannya."}
          </AlertDescription>
          {payInvoice}
        </Alert>
      )
    case "NOT_ACTIVATED":
      return (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Pemasangan belum diaktifkan</AlertTitle>
          <AlertDescription>Aplikasi ini belum terhubung ke lisensinya. Hubungi yang memasang aplikasi.</AlertDescription>
        </Alert>
      )
    case "UNREACHABLE":
      return (
        <Alert variant="info">
          <InfoIcon />
          <AlertTitle>Status lisensi belum bisa dicek</AlertTitle>
          <AlertDescription>Aplikasi tetap jalan. Pengecekan dicoba lagi otomatis.</AlertDescription>
        </Alert>
      )
    default:
      return null
  }
}
