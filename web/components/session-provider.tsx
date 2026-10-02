"use client"

import { useEffect } from "react"

import { useResource } from "@/hooks/use-resource"
import type { Me } from "@/lib/me"
import { setPortalAccess } from "@/lib/portal"
import { ApiFailure } from "@/components/api-failure"
import { PageLoading } from "@/components/app-shell/page-loading"
import { canOpenPortal, SessionContext } from "@/components/session-context"

export { useCan, usePortal, useSession } from "@/components/session-context"

/**
 * Memuat pengguna yang sedang masuk (GET /v1/me) sekali untuk seluruh area
 * aplikasi. Tanpa sesi, klien API mengarahkan ke halaman masuk.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { data, error, loading, reload } = useResource<Me>("/v1/me")
  const portal = canOpenPortal(data)
  useEffect(() => setPortalAccess(portal), [portal])

  if (data) return <SessionContext value={data}>{children}</SessionContext>
  if (loading || error?.status === 401) return <PageLoading label="Membuka aplikasi…" className="min-h-svh" />
  return (
    <div className="mx-auto flex min-h-svh max-w-md items-center p-6">
      {error ? <ApiFailure error={error} onRetry={reload} /> : null}
    </div>
  )
}
