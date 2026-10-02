import { api } from "@/lib/api"
import type { Role } from "@/lib/roles"

export type UserStatus = "ACTIVE" | "SUSPENDED"

/** Satu pengguna di layar Pengguna & Akses. */
export type User = {
  id: string
  subject: string
  email: string
  name: string
  role: Role
  status: UserStatus
  last_login_at: string | null
  created_at: string
  /** Pengguna yang sedang membuka layar: tidak dapat menonaktifkan dirinya. */
  is_self: boolean
}

/** Jawaban GET /v1/users. */
export type UserList = {
  data: User[]
  invite: { available: boolean; reason?: string }
  /** Pengguna aktif dan kuota users.max paket; max null berarti tanpa batas. */
  seats: { active: number; max: number | null }
  assignable_roles: Role[]
}

export type InviteInput = { email: string; display_name: string; role: Role }

/** Jawaban POST /v1/users. temporary_password hanya ada untuk akun GONSU baru. */
export type InviteResult = {
  user: User
  account: "created" | "existing"
  temporary_password?: string
}

export const usersPath = "/v1/users"

export function inviteUser(input: InviteInput) {
  return api<InviteResult>(usersPath, { method: "POST", body: input })
}

export function updateUser(id: string, change: { role?: Role; status?: UserStatus }) {
  return api<User>(`${usersPath}/${id}`, { method: "PATCH", body: change })
}
