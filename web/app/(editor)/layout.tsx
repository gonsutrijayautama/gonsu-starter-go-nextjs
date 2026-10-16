import { SessionProvider } from "@/components/session-provider"

// Layar layar-penuh yang tetap butuh sesi, tanpa kerangka sidebar: editor
// halaman memakai seluruh lebar layar untuk kanvasnya.
export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
