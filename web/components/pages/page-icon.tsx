"use client"

import { createElement } from "react"
import { DynamicIcon, iconNames, type IconName } from "lucide-react/dynamic"
import { PackageIcon } from "lucide-react"

import { siteIcons } from "@/lib/site-icons"

// Ikon di blok halaman: seluruh ikon lucide, disimpan dengan namanya
// ("shopping-bag"). Halaman publik memuat hanya ikon yang dipakai
// (DynamicIcon), bukan seluruh pustakanya. Nama lama dari daftar ikon situs
// ("chart", "headset", …) tetap dikenali.

const known = new Set<string>(iconNames)

export function PageIcon({ name, className }: { name: string; className?: string }) {
  const legacy = siteIcons[name]
  if (legacy) return createElement(legacy.icon, { className, "aria-hidden": true })
  if (known.has(name)) return <DynamicIcon name={name as IconName} className={className} aria-hidden="true" />
  return <PackageIcon className={className} aria-hidden="true" />
}
