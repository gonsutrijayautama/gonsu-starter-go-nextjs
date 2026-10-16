"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useGetPuck } from "@puckeditor/core"

import { ApiError } from "@/lib/api"
import { contentKey } from "@/lib/pages"
import type { Site } from "@/lib/site"

import { blockCatalog, componentCatalog } from "./catalog"
import type { AssistantMessage, ChatEvent, ChatMessage, ChatStatus, Designer } from "./chat"
import { exportSections, importBlocks, updateBlock } from "./import"

/** Jarak bagian baru dari tepi atas kanvas sesudah digulir, supaya tidak tertutup navbar situs. */
const followOffset = 96

/**
 * Kanvas menggulir ke bagian yang baru disusun, mengikuti jawaban yang sedang
 * berjalan. Yang digulir jendela iframe kanvas itu sendiri (`#preview-frame`
 * milik Puck): `scrollIntoView` ikut menggeser kerangka editor di luarnya.
 * Bagiannya baru ada sesudah React merender, jadi dicoba beberapa bingkai.
 */
function follow(id: string, attempts = 5) {
  requestAnimationFrame(() => {
    const frame = document.querySelector<HTMLIFrameElement>("#preview-frame")
    const view = frame?.contentWindow
    const element = frame?.contentDocument?.querySelector(`[data-puck-component="${id}"]`)
    if (view && element) {
      view.scrollTo({ top: view.scrollY + element.getBoundingClientRect().top - followOffset, behavior: "smooth" })
    } else if (attempts > 1) {
      follow(id, attempts - 1)
    }
  })
}

export type AiChat = {
  messages: ChatMessage[]
  /** Jawaban sedang berjalan: pesan baru menunggu sampai selesai atau dihentikan. */
  busy: boolean
  send: (prompt: string) => void
  stop: () => void
  /** Percakapan baru. Isi halaman tidak ikut berubah. */
  reset: () => void
  /** Mengurungkan perubahan halaman dari satu jawaban. */
  undo: (id: string) => void
}

/**
 * Percakapan dengan penyusun halaman di dalam editor Puck. Setiap kejadian
 * dari penyusun langsung diterapkan ke kanvas; riwayat urungkan dicatat
 * sekali di akhir jawaban, jadi satu kali Urungkan mengembalikan halaman ke
 * keadaan sebelum jawaban itu.
 */
export function useAiChat({ site, designer }: { site: Site; designer: Designer }): AiChat {
  const getPuck = useGetPuck()
  const catalog = useMemo(() => blockCatalog(), [])
  const parts = useMemo(() => componentCatalog(), [])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const run = useRef<AbortController | null>(null)

  // Editor ditutup atau dipasang ulang: jawaban yang masih berjalan tidak lagi punya kanvas.
  useEffect(() => {
    const active = run
    return () => active.current?.abort()
  }, [])

  function patch(id: string, change: (message: AssistantMessage) => AssistantMessage) {
    setMessages((previous) => previous.map((message) => (message.id === id && message.role === "assistant" ? change(message) : message)))
  }

  function warn(reply: string, warnings: string[]) {
    if (warnings.length > 0) patch(reply, (message) => ({ ...message, warnings: [...message.warnings, ...warnings] }))
  }

  /** `images`: foto halaman ini yang dikirim ke penyusun sebagai "gambar:N", untuk dikembalikan ke tempatnya. */
  function apply(event: ChatEvent, reply: string, images: Map<string, string>) {
    const { dispatch } = getPuck()
    switch (event.type) {
      case "step":
        patch(reply, (message) => ({
          ...message,
          steps: message.steps.some((step) => step.id === event.id)
            ? message.steps.map((step) => (step.id === event.id ? { ...step, label: event.label } : step))
            : [...message.steps.map((step) => ({ ...step, done: true })), { id: event.id, label: event.label, done: false }],
        }))
        return
      case "text":
        patch(reply, (message) => ({ ...message, text: message.text + event.text }))
        return
      case "clear":
        dispatch({ type: "setUi", ui: { itemSelector: null } })
        dispatch({ type: "setData", data: (previous) => ({ ...previous, content: [] }) })
        return
      case "remove":
        dispatch({ type: "setUi", ui: { itemSelector: null } })
        dispatch({ type: "setData", data: (previous) => ({ ...previous, content: previous.content.filter((item) => item.props.id !== event.id) }) })
        return
      case "update": {
        const live = getPuck().appState.data.content.find((item) => item.props.id === event.id)
        if (!live) return
        let result
        try {
          result = updateBlock({ type: String(live.type), props: live.props }, event.props, catalog, images, parts)
        } catch {
          result = null
        }
        if (!result) {
          warn(reply, ["Satu bagian tidak bisa diubah AI, jadi dibiarkan apa adanya."])
          return
        }
        const { item, warnings } = result
        dispatch({
          type: "setData",
          data: (previous) => ({ ...previous, content: previous.content.map((entry) => (entry.props.id === event.id ? { ...entry, props: { ...item.props, id: event.id } } : entry)) }),
        })
        follow(event.id)
        warn(reply, warnings)
        return
      }
      case "insert": {
        let result
        try {
          result = importBlocks({ content: [event.item] }, catalog, images, parts, () => "Bagian baru")
        } catch {
          warn(reply, ["Satu bagian dari AI tidak bisa dipakai, jadi dilewati."])
          return
        }
        const { content, warnings } = result
        dispatch({
          type: "setData",
          data: (previous) => {
            // Bagian tujuan yang sudah tidak ada (dibuang lebih dulu): taruh di paling bawah.
            const index = event.before ? previous.content.findIndex((item) => item.props.id === event.before) : -1
            const at = index < 0 ? previous.content.length : index
            return { ...previous, content: [...previous.content.slice(0, at), ...content, ...previous.content.slice(at)] }
          },
        })
        follow(String(content.at(-1)?.props.id ?? ""))
        warn(reply, warnings)
      }
    }
  }

  async function answer(prompt: string, history: ChatMessage[], reply: string, controller: AbortController) {
    const snapshot = getPuck().appState.data
    const before = contentKey(snapshot)
    let status: ChatStatus = "done"
    let error: string | undefined
    try {
      const { content } = getPuck().appState.data
      const { sections, images } = exportSections(content, catalog, parts)
      const current = content.map((item, index) => ({ id: String(item.props.id), type: String(item.type), content: sections[index] ?? null }))
      const turns = history.filter((message) => message.text.trim()).map((message) => ({ role: message.role, text: message.text }))
      for await (const event of designer({ prompt, history: turns, site, current, catalog }, controller.signal)) {
        if (controller.signal.aborted) break
        apply(event, reply, images)
      }
      if (controller.signal.aborted) status = "stopped"
    } catch (err) {
      status = controller.signal.aborted ? "stopped" : "failed"
      // Kalimat dari server (AI belum aktif, sedang sibuk, jawaban terpotong) lebih menolong daripada "terputus".
      if (status === "failed" && err instanceof ApiError) error = err.message
    }

    const data = getPuck().appState.data
    const after = contentKey(data)
    // Langkah di tengah tidak masuk riwayat; keadaan akhirnya dicatat satu kali di sini.
    if (after !== before) getPuck().dispatch({ type: "setData", data: (previous) => previous, recordHistory: true })
    patch(reply, (message) => ({
      ...message,
      status,
      error,
      steps: status === "done" ? message.steps.map((step) => ({ ...step, done: true })) : message.steps,
      after: after !== before ? after : undefined,
      before: after !== before ? snapshot : undefined,
    }))
    if (run.current === controller) {
      run.current = null
      setBusy(false)
    }
  }

  return {
    messages,
    busy,
    send(prompt) {
      const text = prompt.trim()
      if (!text || run.current) return
      const controller = new AbortController()
      run.current = controller
      setBusy(true)
      const reply = crypto.randomUUID()
      const history = messages
      setMessages((previous) => [
        ...previous,
        { id: crypto.randomUUID(), role: "user", text },
        { id: reply, role: "assistant", text: "", steps: [], status: "working", warnings: [] },
      ])
      void answer(text, history, reply, controller)
    },
    stop() {
      run.current?.abort()
    },
    reset() {
      run.current?.abort()
      run.current = null
      setBusy(false)
      setMessages([])
    },
    undo(id) {
      // Isi sebelum jawaban dipulihkan langsung, bukan dengan mundur satu langkah riwayat: Puck mencatat
      // riwayat dengan jeda, jadi urungkan yang diklik tepat sesudah jawaban selesai bisa mundur terlalu jauh.
      // Tombolnya hanya tampil selama halaman belum diubah sesudah jawaban itu, jadi pemulihan ini aman.
      const message = messages.find((entry): entry is AssistantMessage => entry.id === id && entry.role === "assistant")
      if (!message?.before) return
      getPuck().dispatch({ type: "setData", data: message.before, recordHistory: true })
      patch(id, (entry) => ({ ...entry, after: undefined, before: undefined }))
    },
  }
}
