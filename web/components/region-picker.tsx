"use client"

import { useEffect, useRef, useState } from "react"

import { regionSearchMinLength, searchRegions } from "@/lib/regions"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

/** Wilayah terpilih: kodenya yang disimpan, labelnya yang ditampilkan. */
export type RegionOption = {
  /** Kode Kemendagri, minimal kabupaten/kota. */
  code: string
  /** Nama lengkap sampai provinsi. */
  label: string
  /** Kode pos, bila wilayahnya sampai desa/kelurahan. */
  postalCode?: string
}

export interface RegionPickerProps {
  /** Id isian; label formulir menunjuk ke sini. */
  id: string
  value: RegionOption | null
  onChange: (value: RegionOption | null) => void
  onBlur?: () => void
  invalid?: boolean
}

/** Jeda sesudah ketikan terakhir sebelum bertanya ke server. */
const SEARCH_DELAY_MS = 250

/**
 * Pemilih wilayah: ketik nama desa, kecamatan, atau kota, lalu pilih dari
 * hasil pencarian server (`/v1/regions/search`).
 *
 * Satu kotak pencarian, bukan empat pilihan bertingkat: orang tahu nama
 * kelurahannya, dan satu pilihan langsung menentukan kecamatan, kota, dan
 * provinsinya. Wilayah DIPILIH, tidak diketik bebas — "Kota Bandung" dan
 * "Kabupaten Bandung" adalah dua daerah yang berbeda.
 */
export function RegionPicker({ id, value, onChange, onBlur, invalid }: RegionPickerProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<RegionOption[]>([])
  const [searching, setSearching] = useState(false)
  const pending = useRef<{ timer?: ReturnType<typeof setTimeout>; controller?: AbortController }>({})

  function cancelPending() {
    clearTimeout(pending.current.timer)
    pending.current.controller?.abort()
  }
  useEffect(() => cancelPending, [])

  function search(input: string) {
    setQuery(input)
    cancelPending()
    const q = input.trim()
    if (q.length < regionSearchMinLength) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const controller = new AbortController()
    pending.current = {
      controller,
      timer: setTimeout(() => {
        searchRegions(q, controller.signal)
          .then((res) => {
            setResults(res.data.map((r) => ({ code: r.code, label: r.label ?? r.name, postalCode: r.postal_code })))
            setSearching(false)
          })
          .catch(() => {
            if (controller.signal.aborted) return
            setResults([])
            setSearching(false)
          })
      }, SEARCH_DELAY_MS),
    }
  }

  const emptyText =
    query.trim().length < regionSearchMinLength
      ? `Ketik minimal ${regionSearchMinLength} huruf nama desa, kecamatan, atau kota.`
      : searching
        ? "Mencari wilayah…"
        : "Wilayah tidak ditemukan."

  return (
    <Combobox<RegionOption>
      items={results}
      // Server yang mencari; daftar tidak disaring lagi di peramban.
      filter={null}
      value={value}
      onValueChange={onChange}
      onInputValueChange={(input, details) => {
        // Hanya ketikan yang memicu pencarian — bukan label yang ditulis ke
        // kotak saat sebuah wilayah dipilih.
        if (details.reason === "input-change") search(input)
      }}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.code}
      isItemEqualToValue={(a, b) => a.code === b.code}
    >
      <ComboboxInput
        id={id}
        className="w-full"
        placeholder="Cari desa, kecamatan, atau kota"
        showClear={value !== null}
        showTrigger={false}
        onBlur={onBlur}
        aria-invalid={invalid}
      />
      <ComboboxContent>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(option: RegionOption) => (
            <ComboboxItem key={option.code} value={option}>
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
