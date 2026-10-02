import { AppFrame } from "@/components/app-frame"
import { BusinessProfileProvider } from "@/components/business-profile-context"
import { SessionProvider } from "@/components/session-provider"

// Area aplikasi: semua halaman di dalam (app) butuh sesi. Frontend ini static
// export, jadi batas aksesnya ditegakkan server Go — layout ini hanya memuat
// pengguna dan mengarahkan ke halaman masuk bila sesi tidak ada.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <BusinessProfileProvider>
        <AppFrame>{children}</AppFrame>
      </BusinessProfileProvider>
    </SessionProvider>
  )
}
