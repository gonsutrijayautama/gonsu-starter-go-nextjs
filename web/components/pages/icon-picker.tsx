"use client"

import { useState } from "react"
import { icons, ChevronDownIcon, SearchIcon, type LucideIcon } from "lucide-react"
import { iconNames } from "lucide-react/dynamic"

import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

import { PageIcon } from "./page-icon"
import { popularIcons } from "./popular-icons"

// Pemilih ikon untuk panel editor: seluruh ikon lucide, dicari menurut nama
// Inggris atau kata Indonesia yang umum. Hanya dimuat di editor (lihat
// `iconField` di field-kit.tsx), jadi pustaka ikon lengkap tidak ikut ke
// halaman publik.

const lucide = icons as Record<string, LucideIcon>

function componentOf(name: string): LucideIcon | undefined {
  const pascal = name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")
  return lucide[pascal]
}

/** Ikon yang paling sering dipakai situs usaha; tampil sebelum mencari. */

/** Kata Indonesia → potongan nama ikon Inggris. */
const synonyms: Record<string, string[]> = {
  toko: ["store", "shop"],
  belanja: ["shopping", "cart", "bag"],
  keranjang: ["cart", "basket"],
  tas: ["bag"],
  kirim: ["truck", "send", "package"],
  paket: ["package", "box"],
  antar: ["truck", "bike"],
  telepon: ["phone"],
  surat: ["mail"],
  email: ["mail"],
  lokasi: ["map", "pin"],
  alamat: ["map", "pin"],
  peta: ["map"],
  jam: ["clock", "watch"],
  waktu: ["clock", "timer"],
  tanggal: ["calendar"],
  bintang: ["star"],
  hati: ["heart"],
  suka: ["heart", "thumbs"],
  aman: ["shield", "lock"],
  kunci: ["lock", "key"],
  hadiah: ["gift"],
  diskon: ["percent", "tag"],
  harga: ["tag", "banknote"],
  uang: ["banknote", "wallet", "coins"],
  bayar: ["credit-card", "wallet", "receipt"],
  dompet: ["wallet"],
  grafik: ["chart"],
  orang: ["user", "users"],
  tim: ["users"],
  pelanggan: ["users", "user"],
  bantuan: ["headset", "help", "life-buoy"],
  pesan: ["message", "mail"],
  chat: ["message"],
  kerja: ["briefcase"],
  kantor: ["building"],
  rumah: ["house", "home"],
  mobil: ["car"],
  motor: ["bike"],
  sepeda: ["bike"],
  pesawat: ["plane"],
  kopi: ["coffee"],
  makan: ["utensils", "chef"],
  kue: ["cake", "cookie"],
  gunting: ["scissors"],
  baju: ["shirt"],
  alat: ["wrench", "hammer", "tool"],
  cat: ["paint", "palette"],
  foto: ["camera", "image"],
  gambar: ["image"],
  musik: ["music"],
  buku: ["book"],
  sekolah: ["graduation", "school"],
  dokter: ["stethoscope", "hospital"],
  obat: ["pill"],
  bayi: ["baby"],
  anjing: ["dog"],
  kucing: ["cat"],
  daun: ["leaf"],
  matahari: ["sun"],
  dunia: ["globe"],
  ponsel: ["smartphone"],
  laptop: ["laptop"],
  centang: ["check"],
  petir: ["zap"],
  kilat: ["zap"],
  roket: ["rocket"],
  ide: ["lightbulb"],
  target: ["target"],
  piala: ["trophy", "award"],
  salaman: ["handshake"],
}

const shownLimit = 240

function search(query: string): string[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return popularIcons.filter((name) => componentOf(name))
  const parts = [needle, ...Object.entries(synonyms).flatMap(([word, hints]) => (word.startsWith(needle) || needle.startsWith(word) ? hints : []))]
  return iconNames.filter((name) => parts.some((part) => name.includes(part)) && componentOf(name))
}

export function IconPicker({ id, value, onChange, disabled }: { id: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const found = search(query)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger id={id} disabled={disabled} render={<Button type="button" variant="outline" className="w-full justify-between font-normal" />}>
        <span className="flex min-w-0 items-center gap-2">
          <PageIcon name={value} className="size-4" />
          <span className="truncate">{value || "Pilih ikon"}</span>
        </span>
        <ChevronDownIcon className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-3 p-3">
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari: toko, kirim, star…"
            aria-label="Cari ikon"
          />
        </InputGroup>
        <p className="text-xs text-muted-foreground">
          {query.trim() ? `${found.length} ikon cocok` : `Ikon populer · ketik untuk mencari di ${iconNames.length} ikon`}
        </p>
        <div className="grid max-h-72 grid-cols-8 gap-1 overflow-y-auto pr-1">
          {found.slice(0, shownLimit).map((name) => {
            const Glyph = componentOf(name)
            if (!Glyph) return null
            return (
              <Button
                key={name}
                type="button"
                variant={name === value ? "secondary" : "ghost"}
                size="icon"
                aria-label={name}
                aria-pressed={name === value}
                title={name}
                onClick={() => {
                  onChange(name)
                  setOpen(false)
                }}
              >
                <Glyph />
              </Button>
            )
          })}
        </div>
        {found.length > shownLimit ? <p className="text-xs text-muted-foreground">Menampilkan {shownLimit} pertama — persempit pencarian.</p> : null}
        {found.length === 0 ? <p className="text-sm text-muted-foreground">Tidak ada ikon bernama “{query.trim()}”.</p> : null}
      </PopoverContent>
    </Popover>
  )
}
