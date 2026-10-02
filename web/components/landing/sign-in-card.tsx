import { InfoIcon, LogInIcon } from "lucide-react"
import { cn } from "cn"

import { product } from "@/lib/product"
import { site } from "@/lib/site"
import { BusinessAvatar } from "@/components/app-shell/generated-avatar"
import { Frame, FrameFooter, FramePanel } from "@/components/reui/frame"
import { buttonVariants } from "@/components/ui/button"

/** Pintu masuk aplikasi untuk karyawan dan pengguna tenant. */
export function SignInCard({ className }: { className?: string }) {
  return (
    <Frame className={cn("w-full max-w-sm bg-muted shadow-2xl", className)}>
      <FramePanel className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <BusinessAvatar seed={product.code} name={product.name} className="size-10" />
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{product.name}</h2>
            <p className="text-sm text-muted-foreground">Masuk pakai akun GONSU Anda.</p>
          </div>
        </div>
        {/* <a> bergaya tombol, bukan Button: /auth/login dilayani server Go lalu
            diarahkan ke GONSU, jadi harus navigasi penuh. */}
        <a href="/auth/login" className={cn(buttonVariants(), "w-full")}>
          <LogInIcon data-icon="inline-start" />
          Masuk
        </a>
        <p className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
          <a href="/auth/gonsu/forgot-password" className="underline-offset-4 hover:underline">
            Lupa sandi?
          </a>
          <span>Versi {product.version}</span>
        </p>
      </FramePanel>
      <FrameFooter className="flex-row items-start gap-2 text-xs text-muted-foreground">
        <InfoIcon aria-hidden="true" className="mt-px size-3.5 shrink-0" />
        <span>Belum punya akses? Minta administrator {site.name} memberi akses.</span>
      </FrameFooter>
    </Frame>
  )
}
