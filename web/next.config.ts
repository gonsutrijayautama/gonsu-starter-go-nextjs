import type { NextConfig } from "next"
import { PHASE_DEVELOPMENT_SERVER } from "next/constants"

// Frontend adalah static export yang disajikan binary Go: tidak ada server
// Node di image rilis. Fitur yang butuh server — rewrites, redirects, headers,
// server actions, proxy — tidak tersedia di sana; login dan izin ditegakkan Go.
export default function config(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    // `make web-dev`: /v1 dan /auth diteruskan ke server Go (`make run`),
    // supaya halaman memanggil API dari origin yang sama persis seperti di
    // rilis. Rewrites hanya ada di sini — static export tidak mendukungnya.
    const api = process.env.API_ORIGIN ?? "http://127.0.0.1:18080"
    return {
      trailingSlash: true,
      // Tanpa ini /v1/notes dialihkan ke /v1/notes/, yang tidak dikenal
      // router Go.
      skipTrailingSlashRedirect: true,
      async rewrites() {
        return [
          { source: "/v1/:path*", destination: `${api}/v1/:path*` },
          { source: "/auth/:path*", destination: `${api}/auth/:path*` },
        ]
      },
    }
  }
  return {
    output: "export",
    // /notes diekspor sebagai notes/index.html, yang dilayani file server Go
    // tanpa aturan rewrite apa pun.
    trailingSlash: true,
  }
}
