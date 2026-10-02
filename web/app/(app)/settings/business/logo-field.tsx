"use client"

import { removeBusinessLogo, uploadBusinessLogo, type BusinessProfile } from "@/lib/business-profile"
import { initials } from "@/components/app-shell/generated-avatar"
import { ImageField } from "@/components/image-field"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

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

/** Mengganti dan menghapus logo bisnis. */
export function LogoField({ profile, onChanged }: { profile: BusinessProfile; onChanged: () => void }) {
  return (
    <ImageField
      noun="logo"
      preview={<BusinessLogo profile={profile} />}
      hasImage={profile.logo !== null}
      hint="PNG, JPEG, atau WebP, maksimal 2 MB. Paling pas berbentuk persegi."
      upload={uploadBusinessLogo}
      remove={removeBusinessLogo}
      removeDescription="Logo hilang dari aplikasi dan halaman depan untuk semua orang. Inisial nama bisnis tampil sebagai gantinya."
      onChanged={onChanged}
    />
  )
}
