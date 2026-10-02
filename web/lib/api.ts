// Klien API. Setiap panggilan ke server Go lewat sini: origin yang sama,
// cookie sesi, envelope galat, dan arah ke halaman masuk saat sesi habis.

export type FieldError = { field: string; message: string }

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: FieldError[] = [],
    readonly requestId?: string,
    /** Key hak pakai yang dibutuhkan, untuk ENTITLEMENT_REQUIRED. */
    readonly requiredEntitlement?: string
  ) {
    super(message)
    this.name = "ApiError"
  }

  /** Pesan untuk satu field formulir, bila server menyebutnya. */
  fieldMessage(field: string): string | undefined {
    return this.details.find((d) => d.field === field)?.message
  }
}

type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  /** Dikirim sebagai JSON. Blob atau File dikirim apa adanya (unggah berkas). */
  body?: unknown
  /** Wajib untuk endpoint yang membuat data; lihat newIdempotencyKey. */
  idempotencyKey?: string
  signal?: AbortSignal
}

export async function api<T>(
  path: string,
  { method = "GET", body, idempotencyKey, signal }: Options = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" }
  const file = body instanceof Blob ? body : undefined
  if (file) headers["Content-Type"] = file.type || "application/octet-stream"
  else if (body !== undefined) headers["Content-Type"] = "application/json"
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey

  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers,
      body: file ?? (body === undefined ? undefined : JSON.stringify(body)),
      credentials: "same-origin",
      signal,
    })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Server tidak bisa dihubungi. Cek koneksi, lalu coba lagi."
    )
  }

  if (res.status === 401) {
    signIn()
    throw new ApiError(401, "UNAUTHENTICATED", "Sesi sudah habis. Silakan masuk lagi.")
  }
  if (res.status === 204) return undefined as T

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const e = data?.error
    throw new ApiError(
      res.status,
      e?.code ?? "INTERNAL_ERROR",
      e?.message ?? "Ada yang salah di server. Coba lagi sebentar lagi.",
      e?.details ?? [],
      e?.request_id,
      e?.required_entitlement
    )
  }
  return data as T
}

/** Mengubah galat apa pun menjadi ApiError supaya layar cukup mengenal satu bentuk. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  return new ApiError(0, "INTERNAL_ERROR", "Ada yang salah. Coba muat ulang halaman.")
}

/** Ke halaman masuk, lalu kembali ke halaman ini sesudahnya. */
export function signIn() {
  const next = window.location.pathname + window.location.search
  // /auth/login dilayani server Go lalu diarahkan ke GONSU, bukan halaman Next.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/auth/login?next=${encodeURIComponent(next)}`)
}

/**
 * Kunci idempotensi untuk satu kali pengisian formulir. Buat sekali saat
 * formulir dibuka, bukan per klik: tombol yang ditekan dua kali, atau retry
 * sesudah koneksi putus, memakai kunci yang sama sehingga data tidak ganda.
 */
export function newIdempotencyKey(): string {
  // crypto.randomUUID hanya ada di secure context; getRandomValues ada di
  // mana saja, termasuk http:// di jaringan lokal.
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}
