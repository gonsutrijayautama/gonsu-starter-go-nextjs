"use client"

import { useState, type ComponentProps } from "react"
import { PaletteIcon } from "lucide-react"

import type { Site } from "@/lib/site"
import { fetchStockMedia, fetchStockVideo, loadStockPhoto, stockCategories, type StockMedia } from "@/lib/stock-media"
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire"

import type { CustomSectionProps } from "../custom-section"
import { OptionPicker } from "../option-picker"
import { importCustomHtml, type CustomImport, type StockRef } from "./custom-import"
import { buildCustomPrompt, customLooks, customMoods, customPages, customSections, customTones, otherCategory, type CustomBrief } from "./custom-prompt"
import { PasteStep, PromptStep, StepBar } from "./wizard-steps"

// "Desain khusus": kuesioner singkat menyusun prompt, pengguna menempelkannya
// di ChatGPT atau Claude miliknya, lalu HTML jawabannya diimpor sebagai blok
// "Bagian khusus". Berbeda dari wizard blok (ai-designer.tsx), di sini AI
// merancang tampilannya sendiri, jadi hasilnya lebih bebas dan kurang terjaga.

type Step = "brief" | "prompt" | "paste" | "preview"
type Mode = "replace" | "append"
/** "prompt": dari kuesioner sampai impor. "import": langsung menempel HTML yang sudah ada. */
type Flow = "prompt" | "import"

/**
 * Jalan masuk dialog. `visit` bertambah setiap dialog dibuka dari sebuah
 * tombol, supaya dialog yang tetap terpasang tahu ada kunjungan baru.
 */
export type CustomEntry = { start: "brief" | "paste"; visit: number }

const steps: { value: Step; label: string }[] = [
  { value: "brief", label: "Konsep" },
  { value: "prompt", label: "Salin ke AI" },
  { value: "paste", label: "Tempel hasil" },
  { value: "preview", label: "Periksa" },
]

const previous: Record<Exclude<Step, "brief">, Step> = { prompt: "brief", paste: "prompt", preview: "paste" }

/** Foto dan video Pixabay yang ditawarkan ke AI. `problem`: kenapa daftarnya kosong, untuk diberitahukan. */
type Offer = { photos: StockMedia["data"]["photos"]; videos: StockMedia["data"]["videos"]; source: string; problem: string }

const noOffer: Offer = { photos: [], videos: [], source: "Pixabay", problem: "" }

/**
 * Mengisi tempat foto dan video yang merujuk Pixabay. Foto diunduh lewat
 * server dan disimpan bersama halaman; video cukup alamatnya. Yang gagal
 * dibiarkan kosong, dan jumlahnya dikembalikan untuk diberitahukan.
 */
async function resolveStock(result: CustomImport): Promise<{ result: CustomImport; failed: number }> {
  const photos = new Map<number, Promise<string | null>>()
  const videos = new Map<number, Promise<string>>()
  const sections = result.sections.map((section) => ({ ...section, photos: [...section.photos], videos: [...section.videos] }))
  let failed = 0
  await Promise.all(
    result.stock.map(async (ref: StockRef) => {
      const section = sections[ref.section]
      if (!section) return
      if (ref.kind === "photo") {
        if (!photos.has(ref.id)) photos.set(ref.id, loadStockPhoto(ref.id).catch(() => null))
        const image = await photos.get(ref.id)!
        if (!image) failed += 1
        section.photos[ref.index] = { label: `Foto Pixabay ${ref.id}`, image }
        return
      }
      if (!videos.has(ref.id)) videos.set(ref.id, fetchStockVideo(ref.id).then((video) => video.url, () => ""))
      const url = await videos.get(ref.id)!
      if (!url) failed += 1
      section.videos[ref.index] = { label: `Video Pixabay ${ref.id}`, url }
    })
  )
  return { result: { ...result, sections }, failed }
}

/**
 * Pertanyaan yang wajib dijawab. `required` di sini prop komponen kuesioner:
 * form-nya noValidate dan pesan galatnya dari QuestionnaireError, jadi tidak
 * ada gelembung validasi peramban yang ingin dicegah aturan lint itu.
 */
function RequiredQuestion(props: Omit<ComponentProps<typeof QuestionnaireItem>, "required">) {
  // eslint-disable-next-line no-restricted-syntax -- prop komponen, bukan atribut native; lihat keterangan di atas
  return <QuestionnaireItem {...props} required />
}

export function CustomDesigner({
  open,
  entry,
  onOpenChange,
  site,
  hasContent,
  onApply,
}: {
  open: boolean
  entry: CustomEntry
  onOpenChange: (open: boolean) => void
  site: Site
  /** Halaman sudah berisi: hasil ditawarkan untuk ditambahkan di bawah, bukan menggantinya. */
  hasContent: boolean
  onApply: (sections: CustomSectionProps[], mode: Mode) => void
}) {
  // Disimpan di luar isi dialog: menutup dialog untuk menyalin ke AI tidak menghapus jawaban kuesioner.
  const [flow, setFlow] = useState<Flow>(entry.start === "paste" ? "import" : "prompt")
  const [step, setStep] = useState<Step>(entry.start)
  const [brief, setBrief] = useState<CustomBrief>(() => ({
    category: "",
    page: customPages[0]!,
    look: "minimal",
    mood: "light",
    color: "",
    sections: [],
    tone: customTones[0]!,
    offer: site.services.map((service) => service.title).join(", ") || site.summary,
    notes: "",
  }))
  const [prompt, setPrompt] = useState("")
  const [offer, setOffer] = useState<Offer>(noOffer)
  /** Sedang menunggu server: daftar foto untuk prompt, atau isi foto dari jawaban AI. */
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState("")
  const [problem, setProblem] = useState("")
  const [result, setResult] = useState<CustomImport | null>(null)
  const [mode, setMode] = useState<Mode>("replace")

  // Kunjungan baru: impor langsung selalu mulai dari langkah tempel; "prompt
  // baru" melanjutkan langkah terakhirnya, kecuali sebelumnya sedang mengimpor.
  const [visit, setVisit] = useState(entry.visit)
  if (visit !== entry.visit) {
    setVisit(entry.visit)
    if (entry.start === "paste") {
      setFlow("import")
      setStep("paste")
      setProblem("")
    } else if (flow === "import") {
      setFlow("prompt")
      setStep("brief")
      setProblem("")
    }
  }

  const set = <K extends keyof CustomBrief>(key: K, value: CustomBrief[K]) => setBrief((before) => ({ ...before, [key]: value }))

  /** Prompt disusun sesudah daftar foto dan video untuk bidang usahanya didapat; tanpa daftar itu AI membuat tempat foto kosong. */
  async function makePrompt() {
    if (!brief.category || busy) return
    setBusy(true)
    let next = noOffer
    try {
      const media = await fetchStockMedia(brief.category)
      next = {
        ...media.data,
        source: media.source,
        problem: media.configured ? "" : "Foto dan video Pixabay belum diaktifkan di server ini, jadi AI membuat tempat foto kosong untuk Anda isi.",
      }
    } catch {
      next = { ...noOffer, problem: "Foto dan video Pixabay sedang tidak bisa diambil, jadi AI membuat tempat foto kosong untuk Anda isi." }
    }
    setOffer(next)
    setPrompt(buildCustomPrompt(brief, site, next))
    setBusy(false)
    setStep("prompt")
  }

  async function check(text: string) {
    if (busy) return
    setProblem("")
    let imported: CustomImport
    try {
      imported = importCustomHtml(text)
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Jawaban AI tidak bisa dibaca.")
      return
    }
    if (imported.stock.length > 0) {
      setBusy(true)
      const resolved = await resolveStock(imported)
      imported = {
        ...resolved.result,
        notes: resolved.failed > 0 ? [...imported.notes, `${resolved.failed} foto atau video Pixabay tidak bisa diambil. Tempatnya dibiarkan kosong untuk Anda isi.`] : imported.notes,
      }
      setBusy(false)
    }
    setResult(imported)
    setMode(hasContent ? "append" : "replace")
    setStep("preview")
  }

  function apply() {
    if (!result) return
    onApply(result.sections, mode)
    setResult(null)
    setAnswer("")
    setStep(flow === "import" ? "paste" : "brief")
    onOpenChange(false)
  }

  return (
    // Klik di luar dialog tidak menutupnya: jawaban kuesioner dan HTML yang sedang ditempel tidak hilang karena salah klik.
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className="flex max-h-[90svh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="gap-3 border-b p-5">
          <DialogTitle className="flex items-center gap-2">
            <PaletteIcon aria-hidden="true" className="size-4" />
            Desain khusus
          </DialogTitle>
          <DialogDescription>
            {flow === "import"
              ? "Tempel atau unggah halaman.html yang sudah dibuat AI Anda. Isinya disaring dulu sebelum masuk ke halaman."
              : "AI milik Anda merancang tampilannya sendiri, tidak dari blok siap pakai. Hasilnya lebih bebas, tapi teksnya diubah lewat kodenya."}
          </DialogDescription>
          <StepBar steps={flow === "import" ? steps.filter((item) => item.value === "paste" || item.value === "preview") : steps} current={step} />
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5">
          {step === "brief" ? (
            <Questionnaire
              shortcuts="numbers"
              onSubmit={(event) => {
                event.preventDefault()
                void makePrompt()
              }}
            >
              <QuestionnaireProgress render={(props, state) => <div {...props}>{`Pertanyaan ${state.current} dari ${state.total}`}</div>} />

              <RequiredQuestion name="category">
                <QuestionnaireTitle>Apa bidang usaha Anda?</QuestionnaireTitle>
                <QuestionnaireDescription>Dipakai untuk memilihkan foto dan video yang sesuai dari Pixabay.</QuestionnaireDescription>
                <QuestionnaireChoices className="sm:grid-cols-2">
                  {[...stockCategories, otherCategory].map((category) => (
                    <QuestionnaireChoice
                      key={category.value}
                      value={category.value}
                      checked={brief.category === category.value}
                      onChange={() => set("category", category.value)}
                    >
                      {category.label}
                    </QuestionnaireChoice>
                  ))}
                </QuestionnaireChoices>
                <QuestionnaireError>Pilih satu bidang usaha untuk lanjut.</QuestionnaireError>
              </RequiredQuestion>

              <RequiredQuestion name="page">
                <QuestionnaireTitle>Halaman apa yang ingin Anda buat?</QuestionnaireTitle>
                <QuestionnaireChoices className="sm:grid-cols-2">
                  {customPages.map((page) => (
                    <QuestionnaireChoice key={page} value={page} checked={brief.page === page} onChange={() => set("page", page)}>
                      {page}
                    </QuestionnaireChoice>
                  ))}
                </QuestionnaireChoices>
                <QuestionnaireError>Pilih satu jenis halaman untuk lanjut.</QuestionnaireError>
              </RequiredQuestion>

              <RequiredQuestion name="look">
                <QuestionnaireTitle>Tampilan seperti apa yang Anda inginkan?</QuestionnaireTitle>
                <QuestionnaireChoices>
                  {customLooks.map((look) => (
                    <QuestionnaireChoice key={look.value} value={look.value} checked={brief.look === look.value} onChange={() => set("look", look.value)}>
                      {look.label}
                      <QuestionnaireChoiceDescription>{look.hint}</QuestionnaireChoiceDescription>
                    </QuestionnaireChoice>
                  ))}
                </QuestionnaireChoices>
                <QuestionnaireError>Pilih satu gaya tampilan untuk lanjut.</QuestionnaireError>
              </RequiredQuestion>

              <RequiredQuestion name="mood">
                <QuestionnaireTitle>Suasana warnanya?</QuestionnaireTitle>
                <QuestionnaireChoices>
                  {customMoods.map((mood) => (
                    <QuestionnaireChoice key={mood.value} value={mood.value} checked={brief.mood === mood.value} onChange={() => set("mood", mood.value)}>
                      {mood.label}
                      <QuestionnaireChoiceDescription>{mood.hint}</QuestionnaireChoiceDescription>
                    </QuestionnaireChoice>
                  ))}
                </QuestionnaireChoices>
                <QuestionnaireError>Pilih satu suasana warna untuk lanjut.</QuestionnaireError>
              </RequiredQuestion>

              <QuestionnaireItem name="color">
                <QuestionnaireTitle>Apa warna merek Anda?</QuestionnaireTitle>
                <QuestionnaireDescription>Kode warna atau namanya. Lewati supaya AI memakai warna tema situs.</QuestionnaireDescription>
                <QuestionnaireInput
                  aria-label="Warna merek"
                  value={brief.color}
                  placeholder="#ea580c, atau “hijau tua”"
                  onChange={(event) => set("color", event.target.value)}
                />
                <QuestionnaireError>Isi warnanya, atau tekan Lewati.</QuestionnaireError>
              </QuestionnaireItem>

              <QuestionnaireItem name="sections" multiple>
                <QuestionnaireTitle>Bagian apa saja yang harus ada?</QuestionnaireTitle>
                <QuestionnaireDescription>Boleh lebih dari satu. Lewati supaya AI memilih yang paling cocok.</QuestionnaireDescription>
                <QuestionnaireChoices className="sm:grid-cols-2">
                  {customSections.map((section) => (
                    <QuestionnaireChoice
                      key={section}
                      value={section}
                      checked={brief.sections.includes(section)}
                      onChange={(event) =>
                        set("sections", event.target.checked ? [...brief.sections, section] : brief.sections.filter((item) => item !== section))
                      }
                    >
                      {section}
                    </QuestionnaireChoice>
                  ))}
                </QuestionnaireChoices>
                <QuestionnaireError>Pilih bagiannya, atau tekan Lewati.</QuestionnaireError>
              </QuestionnaireItem>

              <RequiredQuestion name="tone">
                <QuestionnaireTitle>Gaya bahasanya?</QuestionnaireTitle>
                <QuestionnaireChoices className="sm:grid-cols-2">
                  {customTones.map((tone) => (
                    <QuestionnaireChoice key={tone} value={tone} checked={brief.tone === tone} onChange={() => set("tone", tone)}>
                      {tone}
                    </QuestionnaireChoice>
                  ))}
                </QuestionnaireChoices>
                <QuestionnaireError>Pilih satu gaya bahasa untuk lanjut.</QuestionnaireError>
              </RequiredQuestion>

              <RequiredQuestion name="offer">
                <QuestionnaireTitle>Apa yang Anda tawarkan?</QuestionnaireTitle>
                <QuestionnaireDescription>Produk atau layanan utamanya, beserta harga bila ingin ditampilkan. AI tidak boleh mengarang harga.</QuestionnaireDescription>
                <QuestionnaireInput
                  aria-label="Produk atau layanan"
                  value={brief.offer}
                  placeholder="Nama produk atau layanan utama, harganya, dan cara memesannya"
                  onChange={(event) => set("offer", event.target.value)}
                />
                <QuestionnaireError>Tulis produk atau layanannya untuk lanjut.</QuestionnaireError>
              </RequiredQuestion>

              <QuestionnaireItem name="notes">
                <QuestionnaireTitle>Ada catatan lain?</QuestionnaireTitle>
                <QuestionnaireDescription>Misalnya situs yang tampilannya Anda sukai, atau hal yang ingin ditonjolkan. Boleh dilewati.</QuestionnaireDescription>
                <QuestionnaireInput
                  aria-label="Catatan lain"
                  value={brief.notes}
                  placeholder="Hal yang ingin ditonjolkan, atau situs yang tampilannya Anda sukai"
                  onChange={(event) => set("notes", event.target.value)}
                />
                <QuestionnaireError>Tulis catatannya, atau tekan Lewati.</QuestionnaireError>
              </QuestionnaireItem>

              <QuestionnaireActions>
                <QuestionnairePrevious>Kembali</QuestionnairePrevious>
                <QuestionnaireSkip>Lewati</QuestionnaireSkip>
                <QuestionnaireNext>Lanjut</QuestionnaireNext>
                <QuestionnaireSubmit disabled={busy}>{busy ? "Menyiapkan foto…" : "Buat prompt"}</QuestionnaireSubmit>
              </QuestionnaireActions>
            </Questionnaire>
          ) : null}

          {step === "prompt" ? (
            <div className="flex flex-col gap-5">
              <PromptStep prompt={prompt} fileName="halaman.html" id="custom-prompt" />
              <StockOffer offer={offer} />
            </div>
          ) : null}

          {step === "paste" ? (
            <PasteStep
              answer={answer}
              onAnswer={setAnswer}
              onFile={(text) => void check(text)}
              problem={problem}
              fileName="halaman.html"
              accept=".html,.htm,.txt,text/html,text/plain"
              id="custom"
            />
          ) : null}

          {step === "preview" && result ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">{result.sections.length} bagian siap dimasukkan</span>
                <ol className="flex flex-col divide-y rounded-xl border">
                  {result.sections.map((section, index) => (
                    <li key={index} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="w-5 text-muted-foreground tabular-nums">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{section.name}</span>
                      <span className="shrink-0 text-muted-foreground">{mediaSummary(section)}</span>
                    </li>
                  ))}
                </ol>
              </div>
              {result.notes.length > 0 ? (
                <Alert variant="warning">
                  <AlertTitle>Yang disesuaikan dari jawaban AI</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4">
                      {result.notes.map((note, index) => (
                        <li key={index}>{note}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}
              <OptionPicker
                id="custom-apply"
                label="Masukkan ke halaman"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "replace", label: "Ganti isi halaman" },
                  { value: "append", label: "Tambahkan di bawah" },
                ]}
              />
              <p className="text-sm text-muted-foreground">
                Foto dari Pixabay sudah terpasang dan bisa diganti. Tempat foto yang masih kosong diisi sesudahnya: pilih bagiannya di kanvas, lalu unggah fotonya
                di panel kanan.
              </p>
            </div>
          ) : null}
        </div>

        {step !== "brief" ? (
          <DialogFooter className="mx-0 mb-0">
            {flow === "import" && step === "paste" ? null : (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setProblem("")
                  setStep(previous[step])
                }}
              >
                Kembali
              </Button>
            )}
            {step === "prompt" ? (
              <Button type="button" onClick={() => setStep("paste")}>
                Saya sudah punya jawabannya
              </Button>
            ) : null}
            {step === "paste" ? (
              <Button type="button" aria-disabled={!answer.trim() || busy} className="aria-disabled:opacity-50" onClick={() => answer.trim() && void check(answer)}>
                {busy ? "Mengambil foto dari Pixabay…" : "Periksa hasil"}
              </Button>
            ) : null}
            {step === "preview" ? (
              <Button type="button" onClick={apply}>
                Masukkan ke halaman
              </Button>
            ) : null}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/** "3 foto, 1 video" untuk satu bagian: berapa yang sudah terisi dari berapa tempatnya. */
function mediaSummary(section: CustomSectionProps): string {
  const parts: string[] = []
  const filled = section.photos.filter((photo) => photo.image).length
  if (section.photos.length > 0) parts.push(filled === section.photos.length ? `${filled} foto` : `${filled} dari ${section.photos.length} foto terisi`)
  if (section.videos.length > 0) parts.push(`${section.videos.length} video`)
  return parts.join(", ")
}

/** Foto yang ditawarkan ke AI, dengan sumbernya: ketentuan Pixabay meminta sumber disebut di samping hasil pencarian. */
function StockOffer({ offer }: { offer: Offer }) {
  if (offer.problem) {
    return (
      <Alert variant="info">
        <AlertDescription>{offer.problem}</AlertDescription>
      </Alert>
    )
  }
  if (offer.photos.length === 0 && offer.videos.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">
        Foto dan video yang ditawarkan ke AI, dari{" "}
        <a href="https://pixabay.com/" target="_blank" rel="noreferrer" className="underline underline-offset-4">
          {offer.source}
        </a>
      </p>
      <ul className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
        {offer.photos.slice(0, 16).map((photo) => (
          <li key={photo.id}>
            <a
              href={photo.page_url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Foto ${photo.tags} oleh ${photo.user} di ${offer.source}`}
              className="block aspect-square rounded-md bg-muted bg-cover bg-center"
              style={{ backgroundImage: `url("${photo.preview_url}")` }}
            />
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        AI memilih dari daftar ini. Foto yang dipakai disalin ke halaman Anda saat hasilnya diimpor
        {offer.videos.length > 0 ? `; ${offer.videos.length} video diputar langsung dari ${offer.source}` : ""}.
      </p>
    </div>
  )
}
