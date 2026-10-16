import { ApiError } from "@/lib/api"
import { fetchPageAi, streamPageAiReply } from "@/lib/page-ai"

import type { ChatEvent, Designer } from "./chat"
import { buildChatGuide } from "./prompt"
import { simulateDesigner } from "./simulate"

// Penyusun halaman dengan AI sungguhan. Server Go (internal/pageai) yang
// berbicara dengan modelnya dan mengalirkan perintahnya; di sini perintah itu
// diterjemahkan menjadi kejadian untuk kanvas (chat.ts).

/** Percakapan yang ikut dikirim: cukup untuk mengerti "yang tadi", tanpa membengkakkan permintaan. */
const historyTurns = 8

function typeOf(item: unknown): string {
  const type = (item as { type?: unknown } | null)?.type
  return typeof type === "string" ? type : ""
}

export const remoteDesigner: Designer = async function* (request, signal): AsyncGenerator<ChatEvent> {
  const label = (type: string) => request.catalog.find((block) => block.type === type)?.label ?? type
  // AI menunjuk bagian dengan rujukan pendek: id Puck terlalu panjang dan mudah salah salin.
  const sections = new Map(request.current.map((section, index) => [`s${index + 1}`, section]))

  yield { type: "step", id: "read", label: "Membaca profil usaha dan isi halaman" }

  const events = streamPageAiReply(
    {
      prompt: request.prompt,
      history: request.history.slice(-historyTurns),
      sections: [...sections].map(([ref, section]) => ({ ref, type: section.type, props: section.content?.props ?? null })),
      guide: buildChatGuide(request.catalog, request.site),
    },
    signal
  )

  let built = 0
  let changed = 0
  let removed = 0
  let said = false
  let finished = false
  for await (const event of events) {
    switch (event.type) {
      case "clear":
        yield { type: "clear" }
        break
      case "insert":
        built += 1
        yield { type: "step", id: "build", label: `Menyusun ${label(typeOf(event.item))} (bagian ke-${built})` }
        yield { type: "insert", item: event.item, before: event.before ? sections.get(event.before)?.id : undefined }
        break
      case "update": {
        const section = sections.get(event.ref)
        if (!section) break
        changed += 1
        yield { type: "step", id: "change", label: `Mengubah ${label(section.type)}` }
        yield { type: "update", id: section.id, props: event.props }
        break
      }
      case "remove": {
        const section = sections.get(event.ref)
        if (!section) break
        removed += 1
        yield { type: "step", id: "remove", label: `Membuang ${label(section.type)}` }
        yield { type: "remove", id: section.id }
        break
      }
      case "text":
        said = true
        yield { type: "text", text: event.text }
        break
      case "error":
        throw new ApiError(503, event.code, event.message)
      case "done":
        finished = true
        break
    }
  }
  // Aliran yang berakhir tanpa "done" terputus di jalan: jawabannya belum tentu utuh.
  if (!finished) throw new ApiError(0, "NETWORK_ERROR", "Jawaban AI terputus di tengah jalan. Coba kirim lagi permintaannya.")

  if (built > 0) yield { type: "step", id: "build", label: `${built} bagian disusun` }
  if (changed > 0) yield { type: "step", id: "change", label: `${changed} bagian diubah` }
  if (removed > 0) yield { type: "step", id: "remove", label: `${removed} bagian dibuang` }
  if (!said) yield { type: "text", text: "Sudah saya kerjakan. Periksa hasilnya di kanvas." }
}

/**
 * Penyusun yang dipakai editor: AI sungguhan bila server punya kunci modelnya,
 * simulasi bila tidak — supaya layar chat tetap bisa dicoba dan diuji tanpa
 * kunci. Status server yang tidak terbaca dianggap tidak punya kunci.
 */
export const pageDesigner: Designer = async function* (request, signal): AsyncGenerator<ChatEvent> {
  const configured = await fetchPageAi().then(
    (status) => status.configured,
    () => false
  )
  yield* (configured ? remoteDesigner : simulateDesigner)(request, signal)
}
