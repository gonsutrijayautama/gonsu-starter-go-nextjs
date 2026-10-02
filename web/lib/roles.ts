// Role milik produk ini (internal/authz). Nama yang tampil di layar.
export type Role = "administrator" | "staff" | "viewer"

export const roleLabel: Record<Role, string> = {
  administrator: "Administrator",
  staff: "Staf",
  viewer: "Hanya lihat",
}

export const roleDescription: Record<Role, string> = {
  administrator: "Semua fitur, termasuk memberi akses ke orang lain.",
  staff: "Membuat dan mengubah data.",
  viewer: "Hanya membaca data.",
}
