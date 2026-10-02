"use client"

import { useState } from "react"

import { useFileUpload } from "@/hooks/use-file-upload"
import {
  logoAccept,
  logoMaxBytes,
  removeBusinessLogo,
  uploadBusinessLogo,
  type BusinessProfile,
} from "@/lib/business-profile"
import { runWithToast } from "@/lib/toast-action"
import { ConfirmAction } from "@/components/app-shell/confirm-action"
import { initials } from "@/components/app-shell/generated-avatar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"

/** Logo bisnis, atau inisial namanya bila belum ada logo. */
export function BusinessLogo({ profile }: { profile: BusinessProfile }) {
  return (
    <Avatar className="size-16 rounded-lg after:rounded-lg">
      {profile.logo ? (
        <AvatarImage src={profile.logo.url} alt="Logo bisnis" className="rounded-[inherit] object-contain" />
      ) : null}
      <AvatarFallback className="rounded-[inherit]">{initials(profile.display_name || "Bisnis")}</AvatarFallback>
    </Avatar>
  )
}

/**
 * Mengganti dan menghapus logo. Berkas langsung diunggah begitu dipilih —
 * logo bukan bagian formulir, jadi tidak menunggu tombol Simpan.
 */
export function LogoField({ profile, onChanged }: { profile: BusinessProfile; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(false)

  function run(action: Promise<BusinessProfile>, text: { loading: string; success: string }) {
    setBusy(true)
    runWithToast(action, text)
      .then(onChanged)
      .catch(() => undefined) // galat sudah menjadi toast
      .finally(() => setBusy(false))
  }

  const [, { openFileDialog, getInputProps, clearFiles }] = useFileUpload({
    accept: logoAccept,
    maxSize: logoMaxBytes,
    onFilesAdded: (added) => {
      const file = added[0]?.file
      // Hook hanya menyimpan pilihan; daftarnya dikosongkan supaya berkas
      // yang sama dapat dipilih lagi sesudah gagal.
      clearFiles()
      if (file instanceof File) {
        run(uploadBusinessLogo(file), { loading: "Mengunggah logo…", success: "Logo diganti" })
      }
    },
    // Pesan hook berbahasa Inggris; yang ditampilkan kalimat sendiri.
    onError: () =>
      toast.add({
        type: "error",
        title: "Logo tidak bisa dipakai",
        description: "Pilih gambar PNG, JPEG, atau WebP, maksimal 2 MB.",
      }),
  })

  return (
    <div className="flex flex-wrap items-center gap-4">
      <BusinessLogo profile={profile} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={openFileDialog} disabled={busy}>
            {profile.logo ? "Ganti logo" : "Unggah logo"}
          </Button>
          {profile.logo ? (
            <Button type="button" variant="ghost" onClick={() => setRemoving(true)} disabled={busy}>
              Hapus logo
            </Button>
          ) : null}
          <Input {...getInputProps()} className="sr-only" aria-label="Berkas logo" tabIndex={-1} />
        </div>
        <p className="text-sm text-muted-foreground">PNG, JPEG, atau WebP, maksimal 2 MB. Paling pas berbentuk persegi.</p>
      </div>
      <ConfirmAction
        open={removing}
        onOpenChange={setRemoving}
        destructive
        title="Hapus logo bisnis?"
        description="Logo hilang dari aplikasi untuk seluruh tim. Inisial nama bisnis tampil sebagai gantinya."
        confirmLabel="Hapus"
        onConfirm={() => run(removeBusinessLogo(), { loading: "Menghapus logo…", success: "Logo dihapus" })}
      />
    </div>
  )
}
