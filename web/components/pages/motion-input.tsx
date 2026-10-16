"use client"

import type { CustomField } from "@puckeditor/core"

import { ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon, BanIcon, BlendIcon, ChevronsUpIcon, DropletsIcon, Repeat1Icon, RepeatIcon, RotateCwIcon, ZoomInIcon } from "lucide-react"

import { Field, FieldDescription } from "@/components/ui/field"

import { SizeSlider } from "./field-kit"
import { OptionPicker, type Option } from "./option-picker"
import { defaultMotion, type MotionSettings, type MotionType } from "./motion"

// Isian animasi di panel editor (jenis, lama, jeda, pengulangan).

export const motionOptions: Option<MotionType>[] = [
  { value: "none", label: "Tanpa animasi", short: "Tanpa", icon: BanIcon },
  { value: "fade", label: "Memudar masuk", short: "Pudar", icon: BlendIcon },
  { value: "up", label: "Naik dari bawah", short: "Naik", icon: ArrowUpIcon },
  { value: "down", label: "Turun dari atas", short: "Turun", icon: ArrowDownIcon },
  { value: "left", label: "Masuk dari kiri", short: "Kiri", icon: ArrowRightIcon },
  { value: "right", label: "Masuk dari kanan", short: "Kanan", icon: ArrowLeftIcon },
  { value: "zoom", label: "Membesar", short: "Besar", icon: ZoomInIcon },
  { value: "blur", label: "Dari buram ke jelas", short: "Buram", icon: DropletsIcon },
  { value: "flip", label: "Berputar masuk", short: "Putar", icon: RotateCwIcon },
  { value: "bounce", label: "Memantul", short: "Pantul", icon: ChevronsUpIcon },
]

const repeatOptions: Option<MotionSettings["repeat"]>[] = [
  { value: "once", label: "Sekali saja", short: "Sekali", icon: Repeat1Icon },
  { value: "always", label: "Setiap kali terlihat", short: "Setiap terlihat", icon: RepeatIcon },
]

/** Isian animasi: jenis, lalu durasi, jeda, dan pengulangan bila ada animasinya. */
export function MotionInput({ id, value, onChange }: { id: string; value?: Partial<MotionSettings>; onChange: (value: MotionSettings) => void }) {
  const look = { ...defaultMotion, ...value }
  const set = <K extends keyof MotionSettings>(key: K, next: MotionSettings[K]) => onChange({ ...look, [key]: next })
  return (
    <Field className="gap-4">
      <OptionPicker id={`${id}-type`} label="Animasi muncul" value={look.type} options={motionOptions} onChange={(next) => set("type", next)} columns={5} />
      {look.type !== "none" ? (
        <>
          <SizeSlider id={`${id}-duration`} label="Lama" value={look.duration} onChange={(next) => set("duration", next || 600)} min={200} max={2000} step={100} unit="ms" fallback={600} />
          <SizeSlider id={`${id}-delay`} label="Jeda sebelum mulai" value={look.delay} onChange={(next) => set("delay", next)} min={0} max={2000} step={100} unit="ms" fallback={0} />
          <OptionPicker id={`${id}-repeat`} label="Diputar" value={look.repeat} options={repeatOptions} onChange={(next) => set("repeat", next)} />
          <FieldDescription>Di editor animasinya langsung diputar setiap pengaturannya berubah.</FieldDescription>
        </>
      ) : null}
    </Field>
  )
}

export const motionField: CustomField<Partial<MotionSettings> | undefined> = {
  type: "custom",
  label: "Animasi",
  render: ({ id, value, onChange }) => (
    <div className="border-t pt-5">
      <MotionInput id={id} value={value} onChange={onChange} />
    </div>
  ),
}
