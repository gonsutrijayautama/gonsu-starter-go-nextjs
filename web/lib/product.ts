// Identitas produk, diisi `gonsu new`. Kode produk harus sama persis dengan
// kode produk di Console GONSU.
export const product = {
  code: "produk-contoh",
  name: "Produk Contoh",
  // Versi rilis, diisi saat build image; "dev" di laptop.
  version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
} as const
