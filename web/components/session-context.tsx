"use client"

import { createContext, useContext } from "react"

import type { Me } from "@/lib/me"
import { Permission } from "@/lib/permissions"

// Konteks sesi, terpisah dari SessionProvider supaya komponen yang dipakai
// provider itu sendiri (ApiFailure) dapat membacanya tanpa impor melingkar.
export const SessionContext = createContext<Me | null>(null)

/** Pengguna yang sedang masuk. Hanya dipakai di dalam SessionProvider. */
export function useSession(): Me {
  const me = useContext(SessionContext)
  if (!me) throw new Error("useSession dipakai di luar SessionProvider")
  return me
}

/** `can(Permission.NotesWrite)`: apakah pengguna ini memegang izinnya. */
export function useCan(): (permission: Permission) => boolean {
  const me = useSession()
  return (permission) => me.permissions.includes(permission)
}

export function canOpenPortal(me: Me | null | undefined): boolean {
  return !!me?.portal && me.permissions.includes(Permission.SettingsSubscriptionView)
}

/**
 * Apakah tautan Portal (langganan, tagihan, paket) boleh ditampilkan kepada
 * pengguna ini: GONSU menyerahkan alamat Portal DAN role-nya mengurus
 * langganan. Aman dipakai di luar SessionProvider (false).
 */
export function usePortal(): boolean {
  return canOpenPortal(useContext(SessionContext))
}
