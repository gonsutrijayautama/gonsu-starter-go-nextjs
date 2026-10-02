import { toast } from "@/components/ui/toast"
import { toApiError, type ApiError } from "@/lib/api"
import { portalAccess, portalLinks } from "@/lib/portal"

/** Kalimat toast satu aksi: selama menunggu, dan sesudah berhasil. */
export interface ActionToast<T> {
  /** Misalnya "Menyimpan catatan…". Judul toast gagal diturunkan darinya. */
  loading: string
  /** Misalnya "Catatan disimpan" — kalimatnya menyebut objeknya, bukan "Berhasil". */
  success: ToastText | ((result: T) => ToastText)
}

export type ToastText = string | { title: string; description?: string }

/** Galat bertahan lebih lama: isinya dibaca, bukan sekadar dilihat. */
const ERROR_TIMEOUT_MS = 10_000

/** "Menyimpan catatan…" → "Gagal menyimpan catatan". */
function failureTitle(loading: string): string {
  const verb = loading.replace(/[.…]+$/, "")
  return `Gagal ${verb.charAt(0).toLowerCase()}${verb.slice(1)}`
}

/**
 * Menjalankan satu aksi ke server dengan toast: "Menyimpan…" begitu dikirim,
 * lalu toast YANG SAMA berganti menjadi berhasil atau gagal. Toast berhasil
 * hanya muncul untuk jawaban yang benar-benar berhasil.
 *
 * Mengembalikan hasilnya, atau melempar ApiError supaya pemanggil dapat
 * menampilkan galat per isian di bawah kolomnya.
 */
export async function runWithToast<T>(action: Promise<T>, text: ActionToast<T>): Promise<T> {
  toast
    .promise(action, {
      // Objek, bukan string: string di sini menjadi KETERANGAN toast, dan
      // keterangan itu tetap menempel sesudah toast berganti menjadi berhasil.
      loading: { title: text.loading },
      success: (result: T) => {
        const value = typeof text.success === "function" ? text.success(result) : text.success
        const { title, description } = typeof value === "string" ? { title: value, description: undefined } : value
        return { type: "success", title, description }
      },
      error: (err: unknown) => {
        const error = toApiError(err)
        return {
          type: "error",
          title: failureTitle(text.loading),
          description: (
            <span className="flex flex-col gap-0.5">
              <span>{error.message}</span>
              {error.requestId ? <span className="font-mono text-xs">request_id: {error.requestId}</span> : null}
            </span>
          ),
          priority: "high" as const,
          timeout: ERROR_TIMEOUT_MS,
          actionProps: portalAction(error),
        }
      },
    })
    // Penolakan sudah menjadi toast gagal; pemanggil menerimanya lewat `action`.
    .catch(() => undefined)
  return action
}

/**
 * Jalan keluar untuk dua penolakan yang bukan kerusakan: fitur di luar paket
 * ("Lihat paket") dan lisensi tidak aktif ("Bayar tagihan") — hanya bagi yang
 * mengurus langganan (lib/portal.ts).
 */
function portalAction(error: ApiError) {
  if (!portalAccess()) return undefined
  const target =
    error.code === "ENTITLEMENT_REQUIRED"
      ? { label: "Lihat paket", href: portalLinks.plans }
      : error.code === "LICENSE_INACTIVE"
        ? { label: "Bayar tagihan", href: portalLinks.invoices }
        : null
  if (!target) return undefined
  return {
    children: target.label,
    // Jalur server (kit GONSU), bukan halaman Next: navigasi penuh.
    onClick: () => window.location.assign(target.href),
  }
}

/**
 * Toast untuk formulir yang ditolak di peramban sebelum dikirim. Kesalahannya
 * tetap tampil di bawah kolomnya; toast ini memastikan orang yang sedang jauh
 * dari kolom itu tahu formulirnya belum terkirim.
 */
export function toastInvalidForm() {
  toast.add({
    type: "error",
    title: "Ada isian yang belum benar",
    description: "Cek keterangan di bawah tiap isian.",
    priority: "high",
    timeout: ERROR_TIMEOUT_MS,
  })
}
