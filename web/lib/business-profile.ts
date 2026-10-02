import { api } from "@/lib/api"

// Profil bisnis: modul standar GONSU (library gonsu-appkit-go), dipasang
// server di internal/modules. Bentuk JSON-nya sama di setiap produk.

export type BusinessType = "" | "individual" | "company"

/** Kode dan nama resmi satu wilayah. */
export type RegionName = { code: string; name: string }

/** Wilayah yang sudah diuraikan sampai provinsi. */
export type ProfileRegion = {
  province: RegionName
  regency: RegionName
  district: RegionName | null
  village: RegionName | null
  /** "Desa Pasteur, Kecamatan Sukajadi, Kota Bandung, Jawa Barat" */
  label: string
}

export type MediaFile = {
  id: string
  /** Relatif terhadap akar situs, dan boleh dibuka tanpa sesi. */
  url: string
  content_type: string
  size: number
  width: number
  height: number
  created_at: string
}

/** Jawaban /v1/business-profile. Isian yang belum diisi berupa string kosong. */
export type BusinessProfile = {
  /** Kosong berarti profil belum pernah disimpan. */
  display_name: string
  industry: string
  email: string
  phone: string
  business_type: BusinessType
  legal_name: string
  /** NPWP 16 digit tanpa pemisah. */
  tax_id: string
  /** Nama jalan, nomor, RT/RW — tanpa wilayah. */
  address: string
  region_code: string
  region: ProfileRegion | null
  postcode: string
  /** Alamat lengkap satu baris: jalan, wilayah, kode pos. */
  address_text: string
  logo: MediaFile | null
  updated_at: string | null
}

/** Body PUT: SELURUH isian dikirim; yang kosong menjadi kosong. */
export type BusinessProfileInput = Pick<
  BusinessProfile,
  | "display_name"
  | "industry"
  | "email"
  | "phone"
  | "business_type"
  | "legal_name"
  | "tax_id"
  | "address"
  | "region_code"
  | "postcode"
>

export const businessProfilePath = "/v1/business-profile"

/** Batas dan jenis berkas logo, sama dengan server. */
export const logoMaxBytes = 2 * 1024 * 1024
export const logoAccept = "image/png,image/jpeg,image/webp"

export const businessTypeLabel: Record<Exclude<BusinessType, "">, string> = {
  individual: "Perorangan",
  company: "Badan usaha",
}

export function updateBusinessProfile(input: BusinessProfileInput) {
  return api<BusinessProfile>(businessProfilePath, { method: "PUT", body: input })
}

/** Mengganti logo. Body-nya isi berkas itu sendiri, bukan JSON. */
export function uploadBusinessLogo(file: File) {
  return api<BusinessProfile>(`${businessProfilePath}/logo`, { method: "PUT", body: file })
}

export function removeBusinessLogo() {
  return api<BusinessProfile>(`${businessProfilePath}/logo`, { method: "DELETE" })
}
