import { api } from "@/lib/api"

// Wilayah Indonesia: modul standar GONSU (library gonsu-appkit-go). Datanya
// tertanam di server; tidak ada daftar wilayah yang disalin ke frontend.

export type RegionLevel = "province" | "regency" | "district" | "village"

/** Satu wilayah, seperti dijawab /v1/regions. */
export type Region = {
  /** Kode Kemendagri: "32", "32.73", "32.73.07", "32.73.07.1001". */
  code: string
  name: string
  level: RegionLevel
  /** Hanya untuk desa/kelurahan. */
  postal_code?: string
  /** Nama lengkap sampai provinsi; hanya di hasil pencarian. */
  label?: string
}

export const regionsPath = "/v1/regions"

/** Query yang lebih pendek dari ini dijawab server dengan daftar kosong. */
export const regionSearchMinLength = 3

/** Mencari kabupaten/kota, kecamatan, dan desa/kelurahan menurut nama. */
export function searchRegions(query: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ q: query, limit: "20" })
  return api<{ data: Region[] }>(`${regionsPath}/search?${params}`, { signal })
}
