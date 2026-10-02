"use client"

import Image from "next/image"
import Link from "next/link"
import { ImageIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { z } from "zod"

import { useApiForm } from "@/hooks/use-api-form"
import type { SiteMode } from "@/lib/site"
import { siteIcons } from "@/lib/site-icons"
import {
  maxServices,
  removeWebsiteImage,
  updateWebsite,
  uploadWebsiteImage,
  type WebsiteImageSlot,
  type WebsiteSettings,
} from "@/lib/website"
import { ApiForm } from "@/components/api-form"
import { FormFooter, FormSection, TextArea, TextInput } from "@/components/form-controls"
import { FormField } from "@/components/form-field"
import { ImageField } from "@/components/image-field"
import { Alert, AlertDescription } from "@/components/reui/alert"
import { Frame, FrameDescription, FrameHeader, FrameTitle } from "@/components/reui/frame"
import { Button } from "@/components/ui/button"
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

// Aturan yang SAMA dengan server (library gonsu-appkit-go, website).
const text = (label: string, max: number) => z.string().trim().max(max, `${label} maksimal ${max} karakter.`)

const httpsUrl = (value: string, hosts?: string[]) => {
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || value.length > 300) return false
    return !hosts || hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
  } catch {
    return false
  }
}

const channel = (hosts: string[]) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || httpsUrl(value, hosts), `Isi alamat lengkapnya, misalnya https://${hosts[0]}/namaakun.`)

function websiteSchema(icons: string[]) {
  return z.object({
    mode: z.enum(["signin", "site"], "Pilih hanya pintu masuk atau web perusahaan."),
    tagline: text("Tagline", 120),
    summary: text("Ringkasan", 400),
    about: z.object({ text: text("Tentang kami", 2000) }),
    services: z
      .array(
        z.object({
          title: text("Nama layanan", 60).min(1, "Nama layanan wajib diisi."),
          description: text("Keterangan layanan", 200),
          icon: z.string().refine((icon) => icons.includes(icon), "Pilih ikon dari daftar."),
        })
      )
      .max(maxServices, `Layanan maksimal ${maxServices}.`),
    contact: z.object({
      hours: text("Jam kerja", 120),
      map_url: z
        .string()
        .trim()
        .refine((value) => value === "" || httpsUrl(value), "Tautan peta harus alamat https yang lengkap."),
      hide_address: z.boolean(),
    }),
    channels: z.object({
      whatsapp: z
        .string()
        .trim()
        .refine((value) => {
          if (value === "") return true
          const digits = value.replace(/\D/g, "").replace(/^0+/, "62")
          return /^\+?[0-9 ().-]+$/.test(value) && digits.length >= 8 && digits.length <= 15
        }, "Nomor WhatsApp belum benar."),
      instagram: channel(["instagram.com"]),
      facebook: channel(["facebook.com", "fb.com"]),
      tiktok: channel(["tiktok.com"]),
      youtube: channel(["youtube.com", "youtu.be"]),
      linkedin: channel(["linkedin.com"]),
    }),
    seo: z.object({ title: text("Judul", 70), description: text("Deskripsi", 160) }),
  })
}

const modes: { value: SiteMode; title: string; description: string }[] = [
  {
    value: "signin",
    title: "Hanya pintu masuk",
    description: "Halaman depan hanya menampilkan nama bisnis dan tombol Masuk.",
  },
  {
    value: "site",
    title: "Web perusahaan",
    description: "Halaman depan memperkenalkan bisnis Anda: tentang, layanan, dan kontak.",
  },
]

const channelFields = [
  { name: "channels.whatsapp", label: "WhatsApp", placeholder: "0812-3456-7890" },
  { name: "channels.instagram", label: "Instagram", placeholder: "https://instagram.com/namaakun" },
  { name: "channels.facebook", label: "Facebook", placeholder: "https://facebook.com/namahalaman" },
  { name: "channels.tiktok", label: "TikTok", placeholder: "https://tiktok.com/@namaakun" },
  { name: "channels.youtube", label: "YouTube", placeholder: "https://youtube.com/@namakanal" },
  { name: "channels.linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/nama" },
] as const

/**
 * Formulir pengaturan website. Menyimpan mengirim SELURUH isian, jadi nilai
 * awal setiap kolom adalah nilai yang tersimpan.
 */
export function WebsiteForm({ settings, onChanged }: { settings: WebsiteSettings; onChanged: () => void }) {
  const { form, isPending, serverErrors } = useApiForm({
    schema: websiteSchema(settings.icons),
    defaultValues: {
      mode: settings.mode,
      tagline: settings.tagline,
      summary: settings.summary,
      about: { text: settings.about.text },
      services: settings.services,
      contact: settings.contact,
      channels: settings.channels,
      seo: { title: settings.seo.title, description: settings.seo.description },
    },
    // version pengaturan yang sedang disunting: bila orang lain sudah
    // menyimpan lebih dulu, server menolak dan pesannya meminta memuat ulang.
    submit: (values) => updateWebsite({ ...values, version: settings.version }),
    toast: { loading: "Menyimpan pengaturan website…", success: "Pengaturan website disimpan" },
    onSuccess: onChanged,
  })
  const iconItems = settings.icons.map((icon) => ({ value: icon, label: siteIcons[icon]?.label ?? icon }))

  return (
    <ApiForm form={form} isPending={isPending} submitLabel="Simpan" Footer={FormFooter}>
      <Frame className="w-full max-w-3xl">
        <FrameHeader>
          <FrameTitle>Halaman depan</FrameTitle>
          <FrameDescription>
            Nama, logo, alamat, telepon, dan email diambil dari{" "}
            <Link href="/settings/business/" className="underline underline-offset-4">
              Profil bisnis
            </Link>
            .
          </FrameDescription>
        </FrameHeader>

        <FormSection title="Tampilan">
          <form.Field name="mode">
            {(field) => (
              <RadioGroup
                aria-label="Tampilan halaman depan"
                value={field.state.value}
                onValueChange={(value) => field.handleChange(value as SiteMode)}
                className="grid gap-3 sm:grid-cols-2"
              >
                {/* Kartu pilihan: FieldLabel > Field horizontal > isi + radio (docs/ui-guide.md). */}
                {modes.map((mode) => (
                  <FieldLabel key={mode.value} htmlFor={`mode-${mode.value}`}>
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>{mode.title}</FieldTitle>
                        <FieldDescription>{mode.description}</FieldDescription>
                      </FieldContent>
                      <RadioGroupItem value={mode.value} id={`mode-${mode.value}`} />
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.values.mode}>
            {(mode) =>
              mode === "signin" ? (
                <Alert variant="info">
                  <AlertDescription>
                    Isian di bawah tetap tersimpan, tetapi baru tampil ke pengunjung setelah Anda memilih Web perusahaan.
                  </AlertDescription>
                </Alert>
              ) : null
            }
          </form.Subscribe>
        </FormSection>

        <FormSection title="Isi">
          <form.Field name="tagline">
            {(field) => (
              <FormField field={field} label="Tagline" description="Kalimat besar di bagian atas halaman." serverError={serverErrors.tagline}>
                <TextInput field={field} placeholder="Misalnya: Pakaian rapi untuk setiap hari" />
              </FormField>
            )}
          </form.Field>
          <form.Field name="summary">
            {(field) => (
              <FormField field={field} label="Ringkasan" description="Satu-dua kalimat: siapa Anda dan melayani siapa." serverError={serverErrors.summary}>
                <TextArea field={field} rows={2} />
              </FormField>
            )}
          </form.Field>
          <form.Field name="about.text">
            {(field) => (
              <FormField field={field} label="Tentang kami" description="Cerita singkat bisnis Anda." serverError={serverErrors["about.text"]}>
                <TextArea field={field} rows={4} />
              </FormField>
            )}
          </form.Field>
          <WebsiteImage
            slot="about"
            noun="foto"
            settings={settings}
            hint="Foto kantor, toko, atau tim, di bagian Tentang kami. PNG, JPEG, atau WebP, maksimal 2 MB."
            removeDescription="Foto hilang dari bagian Tentang kami di halaman depan."
            onChanged={onChanged}
          />
        </FormSection>

        <FormSection title="Layanan" description={`Yang Anda tawarkan, maksimal ${maxServices}.`}>
          <form.Field name="services" mode="array">
            {(services) => (
              <>
                {services.state.value.map((_, index) => (
                  <div key={index} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[10rem_1fr_auto] sm:items-start">
                    <form.Field name={`services[${index}].icon`}>
                      {(field) => (
                        <FormField field={field} label="Ikon" serverError={serverErrors[field.name]}>
                          {/* `items` supaya SelectValue menampilkan label, bukan nilai mentah. */}
                          <Select items={iconItems} value={field.state.value} onValueChange={(value) => value && field.handleChange(value)}>
                            <SelectTrigger id={field.name} className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {iconItems.map((icon) => {
                                const Icon = siteIcons[icon.value]?.icon
                                return (
                                  <SelectItem key={icon.value} value={icon.value}>
                                    {Icon ? <Icon aria-hidden="true" /> : null}
                                    {icon.label}
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        </FormField>
                      )}
                    </form.Field>
                    <div className="grid gap-3">
                      <form.Field name={`services[${index}].title`}>
                        {(field) => (
                          <FormField field={field} label="Nama layanan" serverError={serverErrors[field.name]}>
                            <TextInput field={field} aria-required />
                          </FormField>
                        )}
                      </form.Field>
                      <form.Field name={`services[${index}].description`}>
                        {(field) => (
                          <FormField field={field} label="Keterangan" serverError={serverErrors[field.name]}>
                            <TextInput field={field} placeholder="Satu kalimat: apa yang didapat pelanggan." />
                          </FormField>
                        )}
                      </form.Field>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Hapus layanan ${index + 1}`}
                      onClick={() => services.removeValue(index)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                ))}
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={services.state.value.length >= maxServices}
                    onClick={() => services.pushValue({ title: "", description: "", icon: settings.icons[0] ?? "package" })}
                  >
                    <PlusIcon data-icon="inline-start" />
                    Tambah layanan
                  </Button>
                </div>
              </>
            )}
          </form.Field>
        </FormSection>

        <FormSection title="Kontak">
          <form.Field name="contact.hours">
            {(field) => (
              <FormField field={field} label="Jam kerja" serverError={serverErrors["contact.hours"]}>
                <TextInput field={field} placeholder="Misalnya: Senin–Sabtu 09.00–17.00" />
              </FormField>
            )}
          </form.Field>
          <form.Field name="contact.map_url">
            {(field) => (
              <FormField
                field={field}
                label="Tautan peta"
                description="Tautan bagikan dari Google Maps atau layanan peta lain."
                serverError={serverErrors["contact.map_url"]}
              >
                <TextInput field={field} type="url" placeholder="https://maps.app.goo.gl/…" />
              </FormField>
            )}
          </form.Field>
          <form.Field name="contact.hide_address">
            {(field) => (
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor={field.name}>Sembunyikan alamat</FieldLabel>
                  <FieldDescription>
                    Alamat jalan tidak ditampilkan di halaman depan; kotanya tetap tampil. Cocok bila usaha beralamat rumah.
                  </FieldDescription>
                </FieldContent>
                <Switch id={field.name} checked={field.state.value} onCheckedChange={(checked) => field.handleChange(checked)} />
              </Field>
            )}
          </form.Field>
        </FormSection>

        <FormSection title="Kanal lain" description="Kosongkan yang tidak dipakai.">
          <div className="grid gap-5 sm:grid-cols-2">
            {channelFields.map((entry) => (
              <form.Field key={entry.name} name={entry.name}>
                {(field) => (
                  <FormField field={field} label={entry.label} serverError={serverErrors[entry.name]}>
                    <TextInput field={field} placeholder={entry.placeholder} />
                  </FormField>
                )}
              </form.Field>
            ))}
          </div>
        </FormSection>

        <FormSection
          title="Saat tautan dibagikan"
          description="Judul, deskripsi, dan gambar yang tampil di WhatsApp, media sosial, dan mesin pencari."
        >
          <form.Field name="seo.title">
            {(field) => (
              <FormField field={field} label="Judul" description="Kosong: nama bisnis dan tagline." serverError={serverErrors["seo.title"]}>
                <TextInput field={field} />
              </FormField>
            )}
          </form.Field>
          <form.Field name="seo.description">
            {(field) => (
              <FormField field={field} label="Deskripsi" description="Kosong: ringkasan di atas." serverError={serverErrors["seo.description"]}>
                <TextArea field={field} rows={2} />
              </FormField>
            )}
          </form.Field>
          <WebsiteImage
            slot="seo"
            noun="gambar"
            settings={settings}
            hint="Gambar pratinjau tautan. Kosong: logo bisnis. PNG, JPEG, atau WebP, maksimal 2 MB."
            removeDescription="Pratinjau tautan kembali memakai logo bisnis."
            onChanged={onChanged}
          />
        </FormSection>
      </Frame>
    </ApiForm>
  )
}

/** Satu gambar pengaturan website: foto Tentang kami, atau gambar pratinjau tautan. */
function WebsiteImage({
  slot,
  noun,
  settings,
  hint,
  removeDescription,
  onChanged,
}: {
  slot: WebsiteImageSlot
  noun: string
  settings: WebsiteSettings
  hint: string
  removeDescription: string
  onChanged: () => void
}) {
  const image = slot === "about" ? settings.about.image : settings.seo.image
  return (
    <ImageField
      noun={noun}
      hasImage={image !== null}
      preview={
        <div className="relative flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted text-muted-foreground">
          {image ? <Image src={image.url} alt="" fill unoptimized className="object-cover" /> : <ImageIcon aria-hidden="true" className="size-5" />}
        </div>
      }
      hint={hint}
      upload={(file) => uploadWebsiteImage(slot, file)}
      remove={() => removeWebsiteImage(slot)}
      removeDescription={removeDescription}
      onChanged={onChanged}
    />
  )
}
