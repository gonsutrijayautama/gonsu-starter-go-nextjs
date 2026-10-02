"use client"

import { CircleAlertIcon, RotateCwIcon } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/reui/alert"
import { Button } from "@/components/ui/button"

// Galat tak terduga saat merender halaman. Sidebar dan header tetap ada,
// jadi orang dapat pindah ke halaman lain tanpa memuat ulang.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <PageHeader title="Halaman ini bermasalah" />
      <Alert variant="destructive">
        <CircleAlertIcon />
        <AlertTitle>Ada yang salah saat menampilkan halaman ini.</AlertTitle>
        <AlertDescription>
          Coba muat ulang. Kalau terus terjadi, sampaikan ke pengembang aplikasi
          {error.digest ? ` beserta kode ${error.digest}` : ""}.
        </AlertDescription>
        <AlertAction>
          <Button variant="outline" onClick={reset}>
            <RotateCwIcon data-icon="inline-start" />
            Coba lagi
          </Button>
        </AlertAction>
      </Alert>
    </>
  )
}
