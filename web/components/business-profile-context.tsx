"use client"

import { createContext, use, type ReactNode } from "react"

import { useResource } from "@/hooks/use-resource"
import type { ApiError } from "@/lib/api"
import { businessProfilePath, type BusinessProfile } from "@/lib/business-profile"

type BusinessProfileState = {
  profile?: BusinessProfile
  error?: ApiError
  loading: boolean
  /** Dipanggil sesudah profil atau logonya berubah. */
  reload: () => void
}

const BusinessProfileContext = createContext<BusinessProfileState | null>(null)

/**
 * Memuat profil bisnis (GET /v1/business-profile) sekali untuk seluruh area
 * aplikasi. Kerangka memakainya untuk nama dan logo di sidebar; layar Profil
 * bisnis memakai data yang sama, sehingga menyimpan di sana langsung
 * mengubah sidebar.
 *
 * Gagal memuat tidak menghentikan aplikasi: kerangka jatuh ke nama produk.
 */
export function BusinessProfileProvider({ children }: { children: ReactNode }) {
  const { data, error, loading, reload } = useResource<BusinessProfile>(businessProfilePath)
  return <BusinessProfileContext value={{ profile: data, error, loading, reload }}>{children}</BusinessProfileContext>
}

export function useBusinessProfile(): BusinessProfileState {
  const state = use(BusinessProfileContext)
  if (!state) throw new Error("useBusinessProfile dipakai di luar BusinessProfileProvider")
  return state
}
