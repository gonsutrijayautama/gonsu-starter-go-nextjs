"use client"

import { ThemeProvider } from "next-themes"

import { Toaster } from "@/components/ui/toast"
import { TooltipProvider } from "@/components/ui/tooltip"

/**
 * Provider yang dibutuhkan setiap halaman, dipasang sekali di root layout —
 * bukan di `AppShell`, supaya halaman tanpa sidebar (halaman depan, masuk)
 * tetap punya tema, tooltip, dan toast.
 *
 * Toast memakai manager global, jadi komponen client mana pun cukup:
 *
 *   import { toast } from "@/components/ui/toast"
 *   toast.add({ type: "success", title: "Catatan disimpan" })
 *
 * Untuk aksi ke server, pakai `runWithToast` (`lib/toast-action.ts`).
 *
 * Tema: `attribute="class"` karena token gelap ditulis di bawah `.dark`;
 * `disableTransitionOnChange` supaya perpindahan tema tidak berkedip
 * sepotong-sepotong.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        <Toaster>{children}</Toaster>
      </TooltipProvider>
    </ThemeProvider>
  )
}
