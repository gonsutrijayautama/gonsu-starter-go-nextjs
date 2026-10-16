"use client"

import { createContext, use, useEffect, useRef, useState, type CSSProperties } from "react"
import NumberFlow, { type Format } from "@number-flow/react"

// Angka di blok halaman, dirender NumberFlow: digitnya bergulir saat berubah,
// dan bisa menghitung naik saat pertama terlihat. Penulisan Indonesia (titik
// ribuan, koma desimal); gerak berhenti bagi pengunjung yang memintanya.

export type NumberFormat = "plain" | "compact" | "percent" | "currency" | "decimal"

/**
 * Benar di dalam kanvas editor. NumberFlow adalah custom element yang hanya
 * terdaftar di jendela utama; kanvas Puck adalah iframe dengan registri
 * elemennya sendiri, jadi di sana angka ditampilkan sebagai teks berformat
 * yang sama, tanpa animasi. Dipasang oleh pembungkus iframe editor.
 */
export const InCanvasContext = createContext(false)

/** Angka yang disusun dari isian: angkanya, awalan dan akhirannya. */
export type StatValue = { number?: number; prefix?: string; suffix?: string }

/**
 * Data lama menyimpan angka sebagai teks ("5.000+", "4,9", "24 jam"): dipecah
 * menjadi awalan, angka, dan akhiran. Teks tanpa angka menjadi akhiran saja.
 */
export function parseStat(text: string): { number: number; prefix: string; suffix: string; decimals: number } {
  const match = /^(\D*?)(\d[\d.,]*)(.*)$/.exec(text.trim())
  if (!match) return { number: 0, prefix: "", suffix: text, decimals: 0 }
  const [, prefix = "", digits = "", suffix = ""] = match
  const decimals = digits.includes(",") ? (digits.split(",")[1]?.length ?? 0) : 0
  const number = Number(digits.replace(/\./g, "").replace(",", "."))
  return { number: Number.isFinite(number) ? number : 0, prefix, suffix, decimals }
}

function formatOf(format: NumberFormat, decimals: number): Format {
  const digits = { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
  switch (format) {
    case "compact":
      return { notation: "compact", compactDisplay: "short", maximumFractionDigits: 1 }
    case "percent":
      return { style: "percent", ...digits }
    case "currency":
      return { style: "currency", currency: "IDR", ...digits }
    case "decimal":
      return { ...digits, minimumFractionDigits: Math.max(decimals, 1), maximumFractionDigits: Math.max(decimals, 1) }
    default:
      return { ...digits, useGrouping: true }
  }
}

export function StatNumber({
  number,
  prefix = "",
  suffix = "",
  format = "plain",
  decimals = 0,
  animate,
  className,
  style,
}: {
  number: number
  prefix?: string
  suffix?: string
  format?: NumberFormat
  decimals?: number
  /** Hitung naik dari nol saat pertama terlihat. */
  animate: boolean
  className?: string
  style?: CSSProperties
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!animate || !element) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        setSeen(true)
      },
      { threshold: 0.4 }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [animate])

  const inCanvas = use(InCanvasContext)
  // Persen diisi sebagai 98, ditampilkan 98%.
  const value = format === "percent" ? number / 100 : number
  return (
    <span ref={ref} className={className} style={style}>
      {inCanvas ? (
        `${prefix}${new Intl.NumberFormat("id-ID", formatOf(format, decimals) as Intl.NumberFormatOptions).format(value)}${suffix}`
      ) : (
        <NumberFlow value={animate && !seen ? 0 : value} locales="id-ID" format={formatOf(format, decimals)} prefix={prefix} suffix={suffix} />
      )}
    </span>
  )
}

/** Angka dari isian baru (number/prefix/suffix), atau dari teks data lama. */
export function statOf(item: StatValue & { value?: string }): { number: number; prefix: string; suffix: string; decimals?: number } {
  // Teks lama didahulukan: di editor Puck mengisi isian baru dengan nilai bawaan
  // sebelum `migrateStat` sempat memindahkannya.
  if (item.value?.trim()) return parseStat(item.value)
  return { number: item.number ?? 0, prefix: item.prefix ?? "", suffix: item.suffix ?? "" }
}

/**
 * Memindahkan angka data lama ("5.000+") ke isian baru (angka, awalan,
 * akhiran) saat halaman dibuka di editor, supaya isiannya bisa diubah.
 */
export function migrateStat<T extends StatValue & { value?: string; decimals?: number }>(item: T): T {
  if (!item.value?.trim()) return item
  const parsed = parseStat(item.value)
  return { ...item, number: parsed.number, prefix: parsed.prefix, suffix: parsed.suffix, decimals: parsed.decimals, value: undefined }
}
