"use client"

import { useMemo, useState } from "react"
import type { Data } from "@puckeditor/core"
import {
  BriefcaseIcon,
  HouseIcon,
  MapPinIcon,
  SparklesIcon,
  TicketPercentIcon,
  UsersIcon,
  TagsIcon,
  WrenchIcon,
} from "lucide-react"

import type { Site } from "@/lib/site"
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import { ColorPicker } from "../field-kit"
import { OptionPicker, type Option } from "../option-picker"
import { blockCatalog, componentCatalog } from "./catalog"
import { exportForAi, extractJson, importBlocks, type ImportResult } from "./import"
import { buildPrompt, styleGuides, type Brief, type DesignStyle } from "./prompt"
import { PasteStep, PromptStep, StepBar } from "./wizard-steps"

// "Desain dengan AI" tanpa kunci API: wizard menyusun prompt (pertanyaan,
// katalog blok, aturan), pengguna menempelkannya di ChatGPT atau Claude
// versi web, lalu jawaban JSON-nya diimpor kembali sebagai draf.

type Step = "brief" | "prompt" | "paste" | "preview"
type Mode = "replace" | "append"

const steps: { value: Step; label: string }[] = [
  { value: "brief", label: "Ceritakan" },
  { value: "prompt", label: "Salin ke AI" },
  { value: "paste", label: "Tempel hasil" },
  { value: "preview", label: "Periksa" },
]

const pageTypes: Option<string>[] = [
  { value: "Beranda (halaman utama)", label: "Beranda (halaman utama)", short: "Beranda", icon: HouseIcon },
  { value: "Layanan", label: "Layanan", icon: WrenchIcon },
  { value: "Daftar harga", label: "Daftar harga", short: "Harga", icon: TagsIcon },
  { value: "Tentang kami", label: "Tentang kami", icon: UsersIcon },
  { value: "Promo", label: "Promo", icon: TicketPercentIcon },
  { value: "Kontak dan lokasi", label: "Kontak dan lokasi", short: "Kontak", icon: MapPinIcon },
  { value: "Portofolio hasil kerja", label: "Portofolio hasil kerja", short: "Portofolio", icon: BriefcaseIcon },
  { value: "Halaman lain (lihat catatan)", label: "Halaman lain (jelaskan di catatan)", short: "Lainnya", icon: SparklesIcon },
]

const tones: Option<string>[] = [
  { value: "santai dan ramah", label: "Santai dan ramah", short: "Santai" },
  { value: "profesional dan terpercaya", label: "Profesional dan terpercaya", short: "Profesional" },
  { value: "ceria dan penuh semangat", label: "Ceria dan penuh semangat", short: "Ceria" },
  { value: "mewah dan elegan", label: "Mewah dan elegan", short: "Mewah" },
]

const styles: Option<DesignStyle>[] = (Object.entries(styleGuides) as [DesignStyle, (typeof styleGuides)[DesignStyle]][]).map(([value, guide]) => ({
  value,
  label: `${guide.label}: ${guide.hint}`,
  short: guide.label,
}))

export function AiDesigner({
  open,
  onOpenChange,
  site,
  data,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  site: Site
  data: Data
  onApply: (content: ImportResult["content"], mode: Mode) => void
}) {
  const catalog = useMemo(() => blockCatalog(), [])
  const parts = useMemo(() => componentCatalog(), [])
  // Disimpan di luar isi dialog: menutup dialog untuk menyalin ke AI tidak menghapus isian.
  const [step, setStep] = useState<Step>("brief")
  const [brief, setBrief] = useState<Brief>(() => ({
    mode: "new",
    build: "blocks",
    page: pageTypes[0]!.value,
    business: site.name,
    offer: site.services.map((service) => service.title).join(", ") || site.summary,
    audience: "",
    tone: tones[0]!.value,
    style: "minimal",
    color: "",
    blocks: [],
    notes: "",
  }))
  const [prompt, setPrompt] = useState("")
  const [images, setImages] = useState<Map<string, string>>(new Map())
  const [answer, setAnswer] = useState("")
  const [problem, setProblem] = useState("")
  const [result, setResult] = useState<ImportResult | null>(null)
  const [mode, setMode] = useState<Mode>("replace")

  const set = <K extends keyof Brief>(key: K, value: Brief[K]) => setBrief((previous) => ({ ...previous, [key]: value }))
  const hasContent = (data.content ?? []).length > 0
  const exported = useMemo(() => exportForAi(data, catalog, parts), [data, catalog, parts])
  const skipped = (data.content ?? []).length - exported.content.length

  function makePrompt() {
    setImages(exported.images)
    setPrompt(buildPrompt(brief, catalog, parts, site, brief.mode === "revise" ? { content: exported.content } : undefined))
    setMode(brief.mode === "revise" || !hasContent ? "replace" : "append")
    setStep("prompt")
  }

  function check(text: string) {
    setProblem("")
    try {
      setResult(importBlocks(extractJson(text), catalog, images, brief.build === "design" || brief.mode === "revise" ? parts : []))
      setStep("preview")
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Jawaban AI tidak bisa dibaca.")
    }
  }

  function apply() {
    if (!result) return
    onApply(result.content, mode)
    setResult(null)
    setAnswer("")
    setStep("brief")
    onOpenChange(false)
  }

  const specOf = (type: string) => catalog.find((block) => block.type === type) ?? parts.find((block) => block.type === type)
  const labelOf = (type: string) => (type === "Section" ? "Bagian buatan AI" : (specOf(type)?.label ?? type))
  const layoutOf = (item: ImportResult["content"][number]) => {
    const block = specOf(item.type)
    for (const key of ["variant", "layout", "style"]) {
      const spec = block?.fields[key]
      if (spec?.kind === "enum") return spec.options.find((option) => option.value === item.props[key])?.label
    }
    return undefined
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90svh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="gap-3 border-b p-5">
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon aria-hidden="true" className="size-4" />
            Desain dengan AI
          </DialogTitle>
          <DialogDescription>Pakai ChatGPT atau Claude milik Anda. Hasilnya masuk sebagai draf: bisa diubah atau diurungkan.</DialogDescription>
          <StepBar steps={steps} current={step} />
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5">
          {step === "brief" ? (
            <FieldGroup className="gap-5">
              <OptionPicker
                id="ai-mode"
                label="Mau apa?"
                value={brief.mode}
                onChange={(next) => set("mode", next)}
                options={[
                  { value: "new", label: "Buat halaman baru" },
                  { value: "revise", label: "Perbaiki halaman ini" },
                ]}
                disabled={!hasContent}
              />
              {brief.mode === "new" ? (
                <OptionPicker id="ai-page" label="Halaman apa?" value={brief.page} onChange={(next) => set("page", next)} options={pageTypes} columns={4} />
              ) : skipped > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {skipped} bagian yang Anda susun sendiri (bagian kosong atau komponen) tidak ikut dikirim ke AI. Pilih &ldquo;Tambahkan di bawah&rdquo; saat
                  memasukkan hasilnya bila ingin menyimpannya.
                </p>
              ) : null}
              <div className="grid gap-5 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="ai-business">Nama usaha</FieldLabel>
                  <Input id="ai-business" value={brief.business} onChange={(event) => set("business", event.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="ai-audience">Pelanggannya siapa?</FieldLabel>
                  <Input
                    id="ai-audience"
                    value={brief.audience}
                    placeholder="Siapa yang paling sering membeli atau memakai jasa Anda"
                    onChange={(event) => set("audience", event.target.value)}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="ai-offer">Produk atau layanannya</FieldLabel>
                <Textarea
                  id="ai-offer"
                  rows={2}
                  value={brief.offer}
                  placeholder="Produk atau layanan utama, kisaran harga, jam buka"
                  onChange={(event) => set("offer", event.target.value)}
                />
              </Field>
              <OptionPicker id="ai-tone" label="Gaya bahasa" value={brief.tone} onChange={(next) => set("tone", next)} options={tones} layout="segmented" />
              <OptionPicker
                id="ai-style"
                label="Gaya desain"
                value={brief.style}
                onChange={(next) => set("style", next)}
                options={styles}
                layout="tiles"
                columns={5}
                description={styleGuides[brief.style].hint}
              />
              <OptionPicker
                id="ai-build"
                label="Cara menyusun"
                value={brief.build}
                onChange={(next) => set("build", next)}
                options={[
                  { value: "blocks", label: "Blok siap pakai: rapi dan konsisten", short: "Blok siap pakai" },
                  { value: "design", label: "Desain bebas: AI juga menyusun bagian sendiri dari komponen", short: "Desain bebas" },
                ]}
                layout="segmented"
                description={
                  brief.build === "design"
                    ? "AI boleh merancang bagian khas dari kolom, kartu, judul, dan tombol. Lebih variatif; prompt lebih panjang."
                    : "AI memakai blok siap pakai dengan susunan dan tampilannya. Hasil paling rapi."
                }
              />
              <Field>
                <FieldLabel htmlFor="ai-color">Warna utama merek</FieldLabel>
                <ColorPicker id="ai-color" value={brief.color} onChange={(next) => set("color", next)} />
                <FieldDescription>Otomatis: AI memakai warna tema aplikasi.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel id="ai-blocks-label">Bagian yang diinginkan</FieldLabel>
                <ToggleGroup
                  multiple
                  aria-labelledby="ai-blocks-label"
                  value={brief.blocks}
                  onValueChange={(next) => set("blocks", next as string[])}
                  spacing={1.5}
                  className="grid w-full grid-cols-2 sm:grid-cols-3"
                >
                  {catalog.map((block) => (
                    <ToggleGroupItem
                      key={block.type}
                      value={block.type}
                      variant="outline"
                      className="h-auto justify-start px-2.5 py-1.5 text-left text-xs font-normal whitespace-normal aria-pressed:border-primary aria-pressed:bg-primary/5 aria-pressed:font-medium"
                    >
                      {block.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <FieldDescription>Biarkan kosong supaya AI memilih bagian yang paling cocok.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="ai-notes">Catatan lain (boleh kosong)</FieldLabel>
                <Textarea
                  id="ai-notes"
                  rows={2}
                  value={brief.notes}
                  placeholder="Tonjolkan promo Ramadan; sebutkan bisa pesan antar."
                  onChange={(event) => set("notes", event.target.value)}
                />
              </Field>
            </FieldGroup>
          ) : null}

          {step === "prompt" ? <PromptStep prompt={prompt} fileName="halaman.json" note="termasuk daftar semua blok yang bisa dipakai" /> : null}

          {step === "paste" ? (
            <PasteStep
              answer={answer}
              onAnswer={setAnswer}
              onFile={check}
              problem={problem}
              fileName="halaman.json"
              accept=".json,.txt,application/json,text/plain"
            />
          ) : null}

          {step === "preview" && result ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">{result.content.length} bagian siap dimasukkan</span>
                <ol className="flex flex-col divide-y rounded-xl border">
                  {result.content.map((item, index) => (
                    <li key={item.props.id as string} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="w-5 text-muted-foreground tabular-nums">{index + 1}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-medium">
                          {labelOf(item.type)}
                          {layoutOf(item) ? <span className="font-normal text-muted-foreground"> · {layoutOf(item)}</span> : null}
                        </span>
                        {typeof item.props.title === "string" && item.props.title ? (
                          <span className="truncate text-muted-foreground">{item.props.title}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              {result.warnings.length > 0 ? (
                <Alert variant="warning">
                  <AlertTitle>Beberapa isian disesuaikan</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4">
                      {result.warnings.slice(0, 8).map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                      {result.warnings.length > 8 ? <li>dan {result.warnings.length - 8} lainnya.</li> : null}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}
              <OptionPicker
                id="ai-apply"
                label="Masukkan ke halaman"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "replace", label: "Ganti isi halaman" },
                  { value: "append", label: "Tambahkan di bawah" },
                ]}
              />
              <p className="text-sm text-muted-foreground">Foto diunggah sendiri sesudahnya: tempat foto ditandai di editor.</p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="mx-0 mb-0">
          {step !== "brief" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setProblem("")
                setStep(step === "preview" ? "paste" : step === "paste" ? "prompt" : "brief")
              }}
            >
              Kembali
            </Button>
          ) : null}
          {step === "brief" ? (
            <Button type="button" onClick={makePrompt}>
              Buat prompt
            </Button>
          ) : null}
          {step === "prompt" ? (
            <Button
              type="button"
              onClick={() => {
                setProblem("")
                setStep("paste")
              }}
            >
              Saya sudah punya jawabannya
            </Button>
          ) : null}
          {step === "paste" ? (
            <Button type="button" aria-disabled={!answer.trim()} className="aria-disabled:opacity-50" onClick={() => answer.trim() && check(answer)}>
              Periksa hasil
            </Button>
          ) : null}
          {step === "preview" ? (
            <Button type="button" onClick={apply}>
              Masukkan ke halaman
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
