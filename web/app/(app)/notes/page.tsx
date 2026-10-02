import type { Metadata } from "next"

import { NotesScreen } from "./notes-screen"

export const metadata: Metadata = { title: "Catatan" }

// MODUL CONTOH: pola satu layar bisnis — daftar dalam Frame, formulir dalam
// dialog, izin dari sesi, dan galat per field dari server. Hapus bersama
// internal/notes ketika modul pertama produk sudah jadi.
export default function NotesPage() {
  return <NotesScreen />
}
