import type { Metadata } from "next"

import { product } from "@/lib/product"
import { Home } from "@/components/landing/home"

// Halaman publik "/": web perusahaan bisnis ini sekaligus pintu masuk
// aplikasi. Chart GONSU memakai "/" sebagai probe, jadi halaman ini tidak
// boleh bergantung pada sesi maupun API.
//
// Identitas bisnisnya tidak ditulis di sini. Server Go menyisipkannya ke
// halaman ini saat disajikan — termasuk judul dan deskripsi di bawah, yang
// hanya bawaan sebelum profil bisnis diisi (lib/site.ts).
export const metadata: Metadata = {
  title: { absolute: product.name },
  description: `Masuk ke ${product.name} dengan akun GONSU Anda.`,
}

export default function HomePage() {
  return (
    <>
      <Home />
      {/* Tanpa JavaScript halaman ini tetap pintu masuk. /auth/login dilayani
          server Go, jadi <a>, bukan Link. */}
      <noscript>
        <p className="p-6 text-center text-sm">
          <a href="/auth/login" className="underline underline-offset-4">
            Masuk ke {product.name}
          </a>
        </p>
      </noscript>
    </>
  )
}
