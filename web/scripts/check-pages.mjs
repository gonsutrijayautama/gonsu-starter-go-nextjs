// Setiap halaman memasang judul tabnya sendiri (docs/ui-guide.md §7b1):
// `export const metadata = { title: "…" }` di page.tsx. Tanpa itu tab semua
// halaman bernama sama, dan riwayat peramban tidak dapat dibedakan.
//
// Halaman depan "/" dikecualikan: judulnya nama aplikasi dari layout.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const missing = []
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path)
    else if (name === "page.tsx" && path !== join("app", "page.tsx")) {
      const src = readFileSync(path, "utf8")
      if (!/export const metadata[^=]*=\s*\{[^}]*\btitle\s*:/s.test(src) && !/export (async )?function generateMetadata/.test(src)) {
        missing.push(path)
      }
    }
  }
}
walk("app")
if (missing.length > 0) {
  console.error("Halaman tanpa judul tab — tambahkan export const metadata = { title: \"…\" }:")
  for (const path of missing) console.error(`  ${path}`)
  process.exit(1)
}
