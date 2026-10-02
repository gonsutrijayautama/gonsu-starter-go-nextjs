import { api } from "@/lib/api"

// Halaman depan "/": identitas bisnis dan isi web perusahaannya. Datanya
// milik modul standar GONSU (library gonsu-appkit-go, website) — gabungan
// profil bisnis dan pengaturan website yang sudah disaring untuk pengunjung.
//
// Server Go menyisipkannya ke halaman depan sebagai JSON (`siteDataId`),
// jadi halaman tidak memanggil API untuk menampilkan identitas bisnis.

export type SiteMode = "signin" | "site"

/** Satu layanan. `icon` adalah nama dari `lib/site-icons.tsx`. */
export type SiteService = { title: string; description: string; icon: string }

/** Kanal lain bisnisnya, sudah berupa tautan siap pakai. Kosong: tidak ada. */
export type SiteChannels = {
  whatsapp: string
  instagram: string
  facebook: string
  tiktok: string
  youtube: string
  linkedin: string
}

/** Yang boleh dilihat pengunjung tanpa akun, seperti dijawab /site.json. */
export type Site = {
  /** "signin": hanya pintu masuk; isi lain kosong. "site": web perusahaan. */
  mode: SiteMode
  /** Kosong bila profil bisnis belum diisi. */
  name: string
  industry: string
  logo_url: string
  tagline: string
  summary: string
  about: { text: string; image_url: string }
  services: SiteService[]
  contact: {
    /** Kosong bila alamat disembunyikan. */
    address: string
    city: string
    email: string
    phone: string
    hours: string
    map_url: string
  }
  channels: SiteChannels
  seo: { title: string; description: string; image_url: string }
}

/** Id elemen <script type="application/json"> yang disisipkan server Go. */
export const siteDataId = "gonsu-site"

export const sitePath = "/site.json"

/** Halaman depan tanpa data bisnis: hanya pintu masuk. */
export const emptySite: Site = {
  mode: "signin",
  name: "",
  industry: "",
  logo_url: "",
  tagline: "",
  summary: "",
  about: { text: "", image_url: "" },
  services: [],
  contact: { address: "", city: "", email: "", phone: "", hours: "", map_url: "" },
  channels: { whatsapp: "", instagram: "", facebook: "", tiktok: "", youtube: "", linkedin: "" },
  seo: { title: "", description: "", image_url: "" },
}

/**
 * Data yang disisipkan server ke halaman ini. null bila halamannya tidak
 * disajikan server Go — `make web-dev` — atau isinya tidak terbaca.
 */
export function readInjectedSite(): Site | null {
  const raw = document.getElementById(siteDataId)?.textContent
  if (!raw) return null
  try {
    return JSON.parse(raw) as Site
  } catch {
    return null
  }
}

/** Data yang sama lewat jaringan, untuk halaman yang tidak disisipi server. */
export function fetchSite(signal?: AbortSignal) {
  return api<Site>(sitePath, { signal })
}

/** Tautan tel: dari nomor yang ditulis bebas; undefined bila bukan nomor. */
export function phoneHref(phone: string): string | undefined {
  const digits = phone.replace(/[\s().-]/g, "")
  return /^\+?\d{6,15}$/.test(digits) ? `tel:${digits}` : undefined
}

/** Tautan mailto:; undefined bila bukan alamat email. */
export function emailHref(email: string): string | undefined {
  return /^[^\s@[\]]+@[^\s@[\]]+\.[^\s@[\]]+$/.test(email) ? `mailto:${email}` : undefined
}

/** Kanal yang diisi, urut seperti ditampilkan. */
export function channelLinks(channels: SiteChannels): { label: string; href: string }[] {
  return [
    { label: "WhatsApp", href: channels.whatsapp },
    { label: "Instagram", href: channels.instagram },
    { label: "Facebook", href: channels.facebook },
    { label: "TikTok", href: channels.tiktok },
    { label: "YouTube", href: channels.youtube },
    { label: "LinkedIn", href: channels.linkedin },
  ].filter((channel) => channel.href)
}
