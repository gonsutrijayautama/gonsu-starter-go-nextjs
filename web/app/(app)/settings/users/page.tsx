import type { Metadata } from "next"

import { UsersScreen } from "./users-screen"

export const metadata: Metadata = { title: "Pengguna & Akses" }

export default function UsersPage() {
  return <UsersScreen />
}
