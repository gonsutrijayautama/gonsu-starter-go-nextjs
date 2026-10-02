import type { Metadata } from "next"
import localFont from "next/font/local"

import { product } from "@/lib/product"
import { AppProviders } from "@/components/app-shell/app-providers"
import "./globals.css"

// Font disimpan di repo (fonts/README.md), bukan diunduh saat build.
const inter = localFont({
  src: "../fonts/inter-latin-variable.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-sans",
})

const geistMono = localFont({
  src: "../fonts/geist-mono-latin-variable.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-geist-mono",
})

// Judul tab: nama halaman di depan, nama aplikasi di belakang — tab yang
// menyempit memotong ujung kanan. Setiap halaman cukup menulis namanya.
export const metadata: Metadata = {
  title: { default: product.name, template: `%s · ${product.name}` },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning className={`${inter.variable} ${geistMono.variable} antialiased`}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
