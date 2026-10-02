import type { Permission } from "@/lib/permissions"
import type { Role } from "@/lib/roles"

/** Jawaban GET /v1/me. */
export type Me = {
  id: string
  organization_id: string
  name: string
  email: string
  role: Role
  auth_kind: "DEV" | "GONSU"
  permissions: Permission[]
  /** GONSU menyerahkan alamat Portal: tautan langganan, tagihan, dan paket boleh tampil. */
  portal: boolean
}
