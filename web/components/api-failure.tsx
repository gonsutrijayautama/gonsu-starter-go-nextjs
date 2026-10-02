"use client"

import { CircleAlertIcon, RotateCwIcon, SparklesIcon } from "lucide-react"
import { cn } from "cn"

import type { ApiError } from "@/lib/api"
import { portalLinks } from "@/lib/portal"
import { usePortal } from "@/components/session-context"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/reui/alert"
import { Button, buttonVariants } from "@/components/ui/button"

export interface ApiFailureProps {
  error: ApiError
  /** Bila diisi, tampil tombol "Coba lagi". */
  onRetry?: () => void
}

/**
 * Kegagalan dari API, ditampilkan apa adanya.
 *
 * Pesan server sudah berbahasa Indonesia dan bebas detail infrastruktur, jadi
 * tidak diterjemahkan ulang di sini. `request_id` ikut ditampilkan: itu
 * penghubung keluhan pengguna dengan baris log server.
 *
 * Dua penolakan bukan kerusakan dan diberi jalan keluarnya: fitur yang belum
 * termasuk paket (ENTITLEMENT_REQUIRED → "Lihat paket") dan lisensi yang
 * tidak aktif (LICENSE_INACTIVE → "Bayar tagihan"). Tautannya hanya bagi yang
 * mengurus langganan; yang lain diminta menghubungi administrator.
 */
export function ApiFailure({ error, onRetry }: ApiFailureProps) {
  const portal = usePortal()

  if (error.code === "ENTITLEMENT_REQUIRED" || error.code === "LICENSE_INACTIVE") {
    const upgrade = error.code === "ENTITLEMENT_REQUIRED"
    return (
      <Alert variant="warning">
        <SparklesIcon />
        <AlertTitle>{error.message}</AlertTitle>
        <AlertDescription>
          {portal
            ? upgrade
              ? "Fitur ini ada di paket lain. Lihat paketnya di Portal GONSU."
              : "Cek tagihan dan langganan bisnis ini di Portal GONSU."
            : "Minta administrator memeriksa langganan bisnis Anda."}
        </AlertDescription>
        {portal ? (
          <AlertAction>
            {/* Jalur server (kit GONSU), jadi <a> bergaya tombol, bukan Button. */}
            <a
              href={upgrade ? portalLinks.plans : portalLinks.invoices}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              {upgrade ? "Lihat paket" : "Bayar tagihan"}
            </a>
          </AlertAction>
        ) : null}
      </Alert>
    )
  }

  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>{error.message}</AlertTitle>
      {error.requestId ? (
        <AlertDescription className="font-mono text-xs">request_id: {error.requestId}</AlertDescription>
      ) : null}
      {onRetry ? (
        <AlertAction>
          <Button variant="outline" onClick={onRetry}>
            <RotateCwIcon data-icon="inline-start" />
            Coba lagi
          </Button>
        </AlertAction>
      ) : null}
    </Alert>
  )
}
