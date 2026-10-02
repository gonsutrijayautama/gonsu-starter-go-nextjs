import { api } from "@/lib/api"
import type { MediaFile } from "@/lib/business-profile"
import type { SiteChannels, SiteMode, SiteService } from "@/lib/site"

// Pengaturan website: modul standar GONSU (library gonsu-appkit-go), dipasang
// server di internal/modules. Identitas — nama, logo, kontak, alamat — tidak
// ada di sini; ia dibaca dari profil bisnis.

/** Jawaban /v1/website. Isian yang belum diisi berupa string kosong. */
export type WebsiteSettings = {
  mode: SiteMode
  tagline: string
  summary: string
  about: { text: string; image: MediaFile | null }
  services: SiteService[]
  contact: { hours: string; map_url: string; hide_address: boolean }
  /** WhatsApp berupa digit berkode negara; kanal lain alamat https lengkap. */
  channels: SiteChannels
  seo: { title: string; description: string; image: MediaFile | null }
  /** Nama ikon yang diterima server untuk sebuah layanan. */
  icons: string[]
  /** Dikirim balik saat menyimpan; simpan dengan version lama ditolak (409). */
  version: number
  updated_at: string | null
}

/** Body PUT: SELURUH isian dikirim. Gambar diatur lewat uploadWebsiteImage. */
export type WebsiteInput = {
  mode: SiteMode
  tagline: string
  summary: string
  about: { text: string }
  services: SiteService[]
  contact: { hours: string; map_url: string; hide_address: boolean }
  channels: SiteChannels
  seo: { title: string; description: string }
  version: number
}

/** Tempat gambar: foto "Tentang kami", atau pratinjau saat tautan dibagikan. */
export type WebsiteImageSlot = "about" | "seo"

export const websitePath = "/v1/website"

/** Sama dengan batas server. */
export const maxServices = 8

export function updateWebsite(input: WebsiteInput) {
  return api<WebsiteSettings>(websitePath, { method: "PUT", body: input })
}

/** Mengganti gambar. Body-nya isi berkas itu sendiri, bukan JSON. */
export function uploadWebsiteImage(slot: WebsiteImageSlot, file: File) {
  return api<WebsiteSettings>(`${websitePath}/images/${slot}`, { method: "PUT", body: file })
}

export function removeWebsiteImage(slot: WebsiteImageSlot) {
  return api<WebsiteSettings>(`${websitePath}/images/${slot}`, { method: "DELETE" })
}
