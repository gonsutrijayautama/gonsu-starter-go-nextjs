import { api, apiStream } from "@/lib/api"

// Asisten AI penyusun halaman (/v1/page-ai, internal/pageai di server Go).
// Kunci API dan modelnya tinggal di server; layar mengirim permintaan dan isi
// halaman, lalu menerima perintah yang mengubah halaman, satu per baris.

export const pageAiPath = "/v1/page-ai"

/** Apakah server punya kunci model AI. Kalau tidak, editor memakai penyusun simulasi. */
export type PageAi = { configured: boolean; model: string }

/** Satu bagian halaman saat permintaan dikirim. `props: null`: bukan blok yang dikenal AI. */
export type PageAiSection = { ref: string; type: string; props: unknown | null }

export type PageAiRequest = {
  prompt: string
  history: { role: "user" | "assistant"; text: string }[]
  sections: PageAiSection[]
  /** Data usaha, aturan desain, dan katalog blok (components/pages/ai/prompt.ts). */
  guide: string
}

/** Kejadian dari server. Bagian ditunjuk dengan `ref` yang dikirim di `sections`. */
export type PageAiEvent =
  | { type: "clear" }
  | { type: "insert"; item: unknown; before?: string }
  | { type: "update"; ref: string; props: Record<string, unknown> }
  | { type: "remove"; ref: string }
  | { type: "text"; text: string }
  /** Galat sesudah aliran dimulai. Perintah sebelum ini tetap berlaku. */
  | { type: "error"; code: string; message: string }
  /** Jawaban selesai dengan utuh. Aliran yang berakhir tanpa ini terputus. */
  | { type: "done" }

let status: Promise<PageAi> | undefined

/** Ditanyakan sekali selama halaman terbuka: nilainya hanya berubah saat server dijalankan ulang. */
export function fetchPageAi(): Promise<PageAi> {
  if (!status) {
    const request = api<{ data: PageAi }>(pageAiPath).then((result) => result.data)
    status = request
    // Yang gagal tidak diingat, supaya bisa dicoba lagi.
    request.catch(() => {
      if (status === request) status = undefined
    })
  }
  return status
}

export function streamPageAiReply(body: PageAiRequest, signal: AbortSignal): AsyncGenerator<PageAiEvent> {
  return apiStream<PageAiEvent>(`${pageAiPath}/replies`, { body, signal })
}
