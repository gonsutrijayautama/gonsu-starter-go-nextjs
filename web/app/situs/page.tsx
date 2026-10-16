import type { Metadata } from "next"

import { SiteScreen } from "./site-screen"

// PROTOTIPE halaman publik penyusun halaman. Kelak setiap halaman terbit
// tampil di alamatnya sendiri ("/layanan"), disajikan server Go dari satu
// kerangka HTML ini dengan data halamannya disisipkan.
export const metadata: Metadata = { title: "Pratinjau situs" }

export default function Page() {
  return <SiteScreen />
}
