"use client"

import * as React from "react"
import { cn } from "cn"

export interface CopyrightProps {
  /** Nama pemegang hak cipta, misalnya nama produk. */
  holder: string
  className?: string
}

/**
 * Baris hak cipta untuk kaki sidebar dan kaki halaman depan. Versi aplikasi
 * ada di halaman Pengaturan → Lisensi, bukan di sini.
 */
export function Copyright({ holder, className }: CopyrightProps) {
  // Initializer useState, bukan `new Date()` langsung saat render — yang itu
  // ditolak lint sebagai fungsi tidak murni (docs/ui-guide.md).
  const [year] = React.useState(() => new Date().getFullYear())

  return (
    <p className={cn("px-2 py-1 text-xs text-muted-foreground", className)}>
      © {year} {holder}
    </p>
  )
}
