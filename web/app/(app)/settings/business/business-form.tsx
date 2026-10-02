"use client"

import { useState, type ComponentProps, type ReactNode } from "react"
import { z } from "zod"

import { useApiForm } from "@/hooks/use-api-form"
import {
  businessTypeLabel,
  updateBusinessProfile,
  type BusinessProfile,
  type BusinessType,
} from "@/lib/business-profile"
import { ApiForm } from "@/components/api-form"
import { FormField, type ValidatedField } from "@/components/form-field"
import { RegionPicker, type RegionOption } from "@/components/region-picker"
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame"
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { LogoField } from "./logo-field"

// Aturan yang SAMA dengan server (library gonsu-appkit-go, businessprofile).
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phonePattern = /^[0-9+() .-]{5,32}$/
const digitCount = (value: string) => value.replace(/\D/g, "").length
// Pemisah yang lazim diketik pada NPWP: 01.234.567.8-901.000.
const taxDigits = (value: string) => value.replace(/[.\- ]/g, "")

const profileSchema = z.object({
  display_name: z.string().trim().min(1, "Nama bisnis wajib diisi.").max(120, "Nama bisnis maksimal 120 karakter."),
  industry: z.string().trim().max(120, "Bidang usaha maksimal 120 karakter."),
  email: z
    .string()
    .trim()
    .max(320, "Alamat email belum benar.")
    .refine((value) => value === "" || emailPattern.test(value), "Alamat email belum benar."),
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || (phonePattern.test(value) && digitCount(value) >= 5), "Nomor telepon belum benar."),
  business_type: z.enum(["", "individual", "company"], "Pilih perorangan atau badan usaha."),
  legal_name: z.string().trim().max(200, "Nama legal maksimal 200 karakter."),
  tax_id: z
    .string()
    .trim()
    .refine((value) => value === "" || /^[0-9]{15,16}$/.test(taxDigits(value)), "NPWP harus 16 digit, atau 15 digit untuk format lama."),
  address: z.string().trim().max(500, "Alamat maksimal 500 karakter."),
  region_code: z.string(),
  postcode: z
    .string()
    .trim()
    .refine((value) => value === "" || /^[0-9]{5}$/.test(value), "Kode pos harus 5 angka."),
})

// Select tidak menerima nilai kosong sebagai pilihan; "belum dipilih" memakai
// nilai tersendiri yang diterjemahkan ke string kosong.
const UNSET = "unset"
const businessTypes = [
  { value: UNSET, label: "Belum dipilih" },
  { value: "individual", label: businessTypeLabel.individual },
  { value: "company", label: businessTypeLabel.company },
]

/** Field TanStack Form berisi teks, sebatas yang dibutuhkan isian di sini. */
interface TextField extends ValidatedField {
  state: ValidatedField["state"] & { value: string }
  handleBlur: () => void
  handleChange: (value: string) => void
}

function fieldProps(field: TextField) {
  return {
    id: field.name,
    name: field.name,
    value: field.state.value,
    onBlur: field.handleBlur,
    "aria-invalid": field.state.meta.isTouched && !field.state.meta.isValid,
  }
}

function TextInput({ field, ...props }: { field: TextField } & ComponentProps<typeof Input>) {
  return <Input {...fieldProps(field)} onChange={(event) => field.handleChange(event.target.value)} {...props} />
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <FramePanel>
      <FieldSet>
        <FieldLegend>{title}</FieldLegend>
        <FieldGroup>{children}</FieldGroup>
      </FieldSet>
    </FramePanel>
  )
}

function FormFooter({ children }: { children: ReactNode }) {
  return <div className="flex w-full max-w-3xl justify-end gap-2">{children}</div>
}

/**
 * Formulir profil bisnis. Menyimpan mengirim SELURUH isian, jadi nilai awal
 * setiap kolom adalah nilai yang tersimpan.
 */
export function BusinessForm({ profile, onChanged }: { profile: BusinessProfile; onChanged: () => void }) {
  // Kode wilayah ada di formulir; labelnya hanya untuk kotak pencarian.
  const [region, setRegion] = useState<RegionOption | null>(
    profile.region ? { code: profile.region_code, label: profile.region.label } : null
  )
  const { form, isPending, serverErrors } = useApiForm({
    schema: profileSchema,
    defaultValues: {
      display_name: profile.display_name,
      industry: profile.industry,
      email: profile.email,
      phone: profile.phone,
      business_type: profile.business_type as BusinessType,
      legal_name: profile.legal_name,
      tax_id: profile.tax_id,
      address: profile.address,
      region_code: profile.region_code,
      postcode: profile.postcode,
    },
    submit: (values) => updateBusinessProfile(values),
    toast: { loading: "Menyimpan profil bisnis…", success: "Profil bisnis disimpan" },
    onSuccess: onChanged,
  })

  return (
    <ApiForm form={form} isPending={isPending} submitLabel="Simpan" Footer={FormFooter}>
      <Frame className="w-full max-w-3xl">
        <FrameHeader>
          <FrameTitle>{profile.display_name || "Lengkapi profil bisnis"}</FrameTitle>
          <FrameDescription>Nama dan logo ini tampil untuk seluruh tim di aplikasi.</FrameDescription>
        </FrameHeader>

        <FramePanel>
          <LogoField profile={profile} onChanged={onChanged} />
        </FramePanel>

        <Section title="Identitas">
          <form.Field name="display_name">
            {(field) => (
              <FormField field={field} label="Nama bisnis" description="Nama sehari-hari, seperti yang dikenal pelanggan." serverError={serverErrors.display_name}>
                <TextInput field={field} aria-required />
              </FormField>
            )}
          </form.Field>
          <form.Field name="industry">
            {(field) => (
              <FormField field={field} label="Bidang usaha" serverError={serverErrors.industry}>
                <TextInput field={field} placeholder="Misalnya: Ritel pakaian" />
              </FormField>
            )}
          </form.Field>
        </Section>

        <Section title="Kontak">
          <div className="grid gap-5 sm:grid-cols-2">
            <form.Field name="email">
              {(field) => (
                <FormField field={field} label="Email" serverError={serverErrors.email}>
                  <TextInput field={field} type="email" />
                </FormField>
              )}
            </form.Field>
            <form.Field name="phone">
              {(field) => (
                <FormField field={field} label="Telepon" serverError={serverErrors.phone}>
                  <TextInput field={field} type="tel" />
                </FormField>
              )}
            </form.Field>
          </div>
        </Section>

        <Section title="Identitas legal">
          <form.Field name="business_type">
            {(field) => (
              <FormField field={field} label="Jenis usaha" serverError={serverErrors.business_type}>
                {/* `items` supaya SelectValue menampilkan label, bukan nilai mentah. */}
                <Select
                  items={businessTypes}
                  value={field.state.value || UNSET}
                  onValueChange={(value) => field.handleChange((value === UNSET ? "" : value) as BusinessType)}
                >
                  <SelectTrigger id={field.name} className="w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {businessTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
          </form.Field>
          <form.Field name="legal_name">
            {(field) => (
              <FormField
                field={field}
                label="Nama legal"
                description="Nama yang tercetak di dokumen resmi, bila berbeda dari nama bisnis."
                serverError={serverErrors.legal_name}
              >
                <TextInput field={field} placeholder="Misalnya: PT Baju Sejahtera Makmur" />
              </FormField>
            )}
          </form.Field>
          <form.Field name="tax_id">
            {(field) => (
              <FormField
                field={field}
                label="NPWP"
                description="16 digit. NPWP lama 15 digit otomatis diberi awalan 0."
                serverError={serverErrors.tax_id}
              >
                <TextInput field={field} inputMode="numeric" className="sm:w-64" />
              </FormField>
            )}
          </form.Field>
        </Section>

        <Section title="Alamat">
          <form.Field name="address">
            {(field) => (
              <FormField field={field} label="Alamat" description="Nama jalan, nomor, RT/RW." serverError={serverErrors.address}>
                <Textarea {...fieldProps(field)} onChange={(event) => field.handleChange(event.target.value)} rows={2} />
              </FormField>
            )}
          </form.Field>
          <form.Field name="region_code">
            {(field) => (
              <FormField
                field={field}
                label="Wilayah"
                description="Pilih desa atau kelurahan supaya kode pos terisi sendiri. Minimal kabupaten/kota."
                serverError={serverErrors.region_code}
              >
                <RegionPicker
                  id={field.name}
                  value={region}
                  onBlur={field.handleBlur}
                  invalid={Boolean(serverErrors.region_code)}
                  onChange={(option) => {
                    setRegion(option)
                    field.handleChange(option?.code ?? "")
                    // Kode pos mengikuti desa terpilih; tetap bisa diubah.
                    if (option?.postalCode) form.setFieldValue("postcode", option.postalCode)
                  }}
                />
              </FormField>
            )}
          </form.Field>
          <form.Field name="postcode">
            {(field) => (
              <FormField field={field} label="Kode pos" serverError={serverErrors.postcode}>
                <TextInput field={field} inputMode="numeric" maxLength={5} className="sm:w-32" />
              </FormField>
            )}
          </form.Field>
        </Section>
      </Frame>
    </ApiForm>
  )
}
