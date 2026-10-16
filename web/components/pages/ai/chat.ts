import type { Data } from "@puckeditor/core"
import type { Site } from "@/lib/site"

import type { BlockSpec } from "./catalog"

// Percakapan dengan penyusun halaman. Penyusunnya (`Designer`) mengalirkan
// kejadian satu per satu, supaya halaman terbentuk di kanvas selagi jawaban
// masih berjalan. Ada dua penyusun: AI sungguhan lewat server Go (remote.ts),
// dan simulasi (simulate.ts) bila server tidak punya kunci model AI.

/** Satu bagian halaman sekarang. `content`: isinya dalam bentuk yang dibaca AI (import.ts); null bila bukan blok dari katalog. */
export type CurrentSection = { id: string; type: string; content: { type: string; props: Record<string, unknown> } | null }

/** Yang diketahui penyusun: permintaan, percakapan sebelumnya, profil usaha, dan isi halaman sekarang. */
export type DesignRequest = {
  prompt: string
  /** Giliran sebelum permintaan ini, dari yang paling lama. */
  history: { role: "user" | "assistant"; text: string }[]
  site: Site
  /** Bagian halaman sekarang, berurutan dari atas. */
  current: CurrentSection[]
  catalog: BlockSpec[]
}

export type ChatEvent =
  /** Langkah kerja. `id` yang sama memperbarui baris yang sudah tampil. */
  | { type: "step"; id: string; label: string }
  /** Potongan kalimat jawaban, disambung ke yang sudah ada. */
  | { type: "text"; text: string }
  /** Kosongkan halaman sebelum menyusun yang baru. */
  | { type: "clear" }
  /**
   * Satu bagian baru, dalam bentuk jawaban AI (diperiksa import.ts): tepat di
   * atas bagian ber-id `before`, atau di paling bawah.
   */
  | { type: "insert"; item: unknown; before?: string }
  /** Ubah sebagian isian bagian ber-id itu; isian lain tetap. */
  | { type: "update"; id: string; props: Record<string, unknown> }
  /** Buang bagian ber-id itu. */
  | { type: "remove"; id: string }

export type Designer = (request: DesignRequest, signal: AbortSignal) => AsyncIterable<ChatEvent>

export type ChatStep = { id: string; label: string; done: boolean }

export type ChatStatus = "working" | "done" | "stopped" | "failed"

export type UserMessage = { id: string; role: "user"; text: string }

export type AssistantMessage = {
  id: string
  role: "assistant"
  text: string
  steps: ChatStep[]
  status: ChatStatus
  /** Isian yang disesuaikan pemeriksa saat memasukkan bagian dari AI. */
  warnings: string[]
  /** Sebab jawabannya gagal, dari server; kosong bila hanya terputus. */
  error?: string
  /** Kunci isi halaman sesudah jawaban ini: selama masih sama, perubahannya bisa diurungkan. */
  after?: string
  /** Isi halaman sebelum jawaban ini, yang dipulihkan saat diurungkan. */
  before?: Data
}

export type ChatMessage = UserMessage | AssistantMessage
