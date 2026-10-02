import { IconStack } from "@/components/reui/icon-stack"
import { Spinner } from "@/components/ui/spinner"

export interface PageLoadingProps {
  /** Apa yang sedang dimuat. Disebut supaya menunggu terasa terarah. */
  label?: string
  /**
   * Tinggi area tunggu. Bawaannya untuk area konten di dalam kerangka; halaman
   * tanpa kerangka (halaman publik) memakai tinggi layar: `min-h-svh`.
   */
  className?: string
}

/**
 * Keadaan memuat untuk seluruh aplikasi.
 *
 * Ditulis sekali dan dipakai setiap loading.tsx — bukan disalin per rute atau
 * per aplikasi, yang cepat atau lambat menghasilkan lima gaya menunggu yang
 * berbeda.
 */
export function PageLoading({ label = "Memuat…", className = "min-h-[60vh]" }: PageLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-4 ${className}`}
    >
      <IconStack aria-hidden="true">
        <Spinner className="size-4" />
      </IconStack>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
