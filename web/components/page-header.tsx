import type { ReactNode } from "react"

export interface PageHeaderProps {
  title: string
  /** Satu kalimat yang menjelaskan halaman ini untuk apa. */
  description?: ReactNode
  /** Keadaan halaman ini, satu `Badge`, di kanan judul. */
  badge?: ReactNode
  /** Satu aksi utama. Aksi lain milik menu di dalam isi halaman. */
  action?: ReactNode
}

/**
 * Kepala halaman yang sama untuk seluruh aplikasi.
 *
 * Satu aksi utama, bukan lima yang setara: halaman dengan lima tombol sederajat
 * adalah halaman tanpa arah.
 *
 * TIDAK memuat breadcrumb dan TIDAK memuat tautan "kembali": breadcrumb sudah
 * ada satu kali di header kerangka, dan menaruhnya lagi di sini berarti dua
 * kendali navigasi untuk perpindahan yang sama.
 */
export function PageHeader({ title, description, badge, action }: PageHeaderProps) {
  return (
    <header className="mb-2 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {badge}
          </div>
          {description ? <p className="max-w-prose text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
    </header>
  )
}
