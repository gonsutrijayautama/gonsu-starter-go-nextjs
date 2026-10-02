// Tautan ke Portal GONSU: langganan, tagihan, dan paket bisnis ini. Dilayani
// kit GONSU di server Go (/auth/gonsu/portal/*), yang tahu alamat Portal dan
// bisnisnya — frontend tidak pernah menulis alamat Portal sendiri.
//
// Jalur server: tautkan dengan <a>, bukan <Link>. Tampilkan hanya bila
// usePortal() dari session-provider bernilai true.
export const portalLinks = {
  subscription: "/auth/gonsu/portal/subscription",
  invoices: "/auth/gonsu/portal/invoices",
  plans: "/auth/gonsu/portal/plans",
} as const

// Diisi SessionProvider begitu pengguna dimuat, supaya kode di luar komponen
// (toast gagal di lib/toast-action.tsx) dapat menawarkan tautan yang sama.
let access = false

export function setPortalAccess(value: boolean) {
  access = value
}

export function portalAccess(): boolean {
  return access
}
