import { ChartLineIcon, HeadsetIcon, PackageIcon, WrenchIcon, type LucideIcon } from "lucide-react"

/**
 * Isi web perusahaan di "/": identitas tenant, layanan, dan kontak.
 *
 * Satu pemasangan melayani satu tenant, tetapi SDK GONSU belum membawa profil
 * organisasi (nama, alamat, logo). Sampai ada, isinya ditulis di sini dan ikut
 * di-build. Penggantinya nanti tetap harus tersedia tanpa sesi dan tanpa API:
 * "/" adalah probe chart GONSU.
 *
 * Teks dalam kurung siku adalah tempat yang wajib diisi.
 */
export interface SiteContent {
  /** Nama perusahaan: di header, kaki halaman, dan judul tab "/". */
  name: string
  /** Logo di public/, misalnya "/logo.svg". Kosong: avatar bisnis dari nama. */
  logo?: string
  /** Bidang usaha dan kota, tampil di atas judul. */
  industry: string
  /** Satu-dua kalimat tentang perusahaan, di atas daftar layanan. */
  summary: string
  /** Satu kalimat pendek di kaki halaman. */
  tagline: string
  about: {
    text: string
    /** Foto di public/. Kosong: bidang foto menampilkan tempatnya saja. */
    image?: string
  }
  services: SiteService[]
  contact: {
    address: string
    city: string
    /** Ditulis seperti yang dibaca orang; tautan tel: dibuat darinya. */
    phone: string
    email: string
    hours: string
    /** Tautan peta (Google Maps dan sejenisnya). Kosong: tombol peta disembunyikan. */
    mapUrl?: string
  }
}

export interface SiteService {
  title: string
  description: string
  icon: LucideIcon
}

export const site: SiteContent = {
  name: "[Nama Perusahaan]",
  industry: "[Bidang usaha]",
  summary: "[Satu-dua kalimat tentang perusahaan: sejak kapan berdiri, melayani siapa, dan di mana.]",
  tagline: "[Tagline singkat perusahaan.]",
  about: {
    text: "[Cerita singkat perusahaan: nilai yang dipegang, dan apa yang membuat Anda berbeda.]",
  },
  services: [
    { title: "[Nama layanan 1]", description: "[Satu kalimat: apa yang didapat pelanggan dari layanan ini.]", icon: PackageIcon },
    { title: "[Nama layanan 2]", description: "[Satu kalimat: apa yang didapat pelanggan dari layanan ini.]", icon: ChartLineIcon },
    { title: "[Nama layanan 3]", description: "[Satu kalimat: apa yang didapat pelanggan dari layanan ini.]", icon: WrenchIcon },
    { title: "[Nama layanan 4]", description: "[Satu kalimat: apa yang didapat pelanggan dari layanan ini.]", icon: HeadsetIcon },
  ],
  contact: {
    address: "[Alamat lengkap kantor]",
    city: "[Kota, Provinsi]",
    phone: "[Nomor telepon]",
    email: "[email@perusahaan.co.id]",
    hours: "[Hari dan jam kerja]",
  },
}

/** Tautan tel: dari nomor yang ditulis bebas; undefined bila belum berupa nomor. */
export function phoneHref(phone: string): string | undefined {
  const digits = phone.replace(/[\s().-]/g, "")
  return /^\+?\d{6,15}$/.test(digits) ? `tel:${digits}` : undefined
}

/** Tautan mailto:; undefined bila belum berupa alamat email. */
export function emailHref(email: string): string | undefined {
  return /^[^\s@[\]]+@[^\s@[\]]+\.[^\s@[\]]+$/.test(email) ? `mailto:${email}` : undefined
}
