import { Avatar as DiceBearAvatar, Style } from "@dicebear/core"
import cameo from "@dicebear/styles/cameo.json"
import shapeGrid from "@dicebear/styles/shape-grid.json"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"

/**
 * Avatar yang dibangkitkan DiceBear dari sebuah seed — untuk orang (gaya
 * `cameo`) dan untuk bisnis (gaya `shape-grid`) — sama dengan GONSU One.
 *
 * Kedua gaya berlisensi CC0, jadi tidak ada atribusi yang wajib ditampilkan.
 *
 * Gambarnya data URI yang dibangkitkan di tempat, bukan permintaan ke layanan
 * DiceBear: nama maupun email pengguna tidak boleh ikut terkirim ke pihak
 * ketiga hanya untuk menggambar lingkaran berwarna.
 */

const BACKGROUND_COLORS = ["ffe3ea", "e3edff", "e2f5e9", "fdf1d4", "efe6ff"]

const styles = {
  person: new Style(cameo),
  business: new Style(shapeGrid),
}

export type GeneratedAvatarKind = keyof typeof styles

// Dibatasi karena modul ini juga hidup di server yang berjalan lama: tanpa
// batas, setiap orang dan bisnis yang pernah tampil menumpuk di memori.
const CACHE_LIMIT = 500
const cache = new Map<string, string>()

/** Data URI SVG avatar untuk `seed`; seed yang sama selalu menghasilkan gambar yang sama. */
export function generatedAvatarUri(kind: GeneratedAvatarKind, seed: string): string {
  const key = `${kind}:${seed}`
  const cached = cache.get(key)
  if (cached) return cached

  const uri = new DiceBearAvatar(styles[kind], {
    backgroundColor: BACKGROUND_COLORS,
    seed,
  }).toDataUri()

  if (cache.size >= CACHE_LIMIT) cache.clear()
  cache.set(key, uri)
  return uri
}

/** Inisial dari nama atau email, maksimum dua huruf — cadangan selagi gambar dimuat. */
export function initials(value: string): string {
  return (
    value
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  )
}

export interface GeneratedAvatarProps {
  /**
   * Penentu gambar. Pakai yang STABIL dan unik — email untuk orang, id untuk
   * bisnis — bukan nama: nama dapat berganti dan dapat kembar, dan dua "Budi"
   * dengan avatar yang sama tidak membantu siapa pun membedakannya.
   */
  seed: string
  /** Untuk inisial cadangan. */
  name: string
  className?: string
}

/** Avatar bulat seseorang. */
export function PersonAvatar({ seed, name, className }: GeneratedAvatarProps) {
  return (
    <Avatar className={className}>
      <AvatarImage src={generatedAvatarUri("person", seed)} alt="" />
      <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
    </Avatar>
  )
}

/**
 * Avatar persegi sebuah bisnis.
 *
 * Persegi, bukan bulat, dengan sengaja: orang dan bisnis tampil berdampingan
 * di kerangka yang sama (menu akun dan pemilih bisnis), dan bentuk yang sama
 * membuat keduanya terbaca sebagai hal yang sejenis.
 */
export function BusinessAvatar({ seed, name, className }: GeneratedAvatarProps) {
  return (
    <Avatar className={`rounded-md after:rounded-md after:border-0 ${className ?? ""}`}>
      <AvatarImage
        src={generatedAvatarUri("business", seed)}
        alt=""
        className="rounded-[inherit]"
      />
      <AvatarFallback className="rounded-[inherit] text-xs">{initials(name)}</AvatarFallback>
    </Avatar>
  )
}
