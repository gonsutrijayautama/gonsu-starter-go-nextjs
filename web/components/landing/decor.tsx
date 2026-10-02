"use client"

import Image from "next/image"
import { cn } from "cn"

import { BusinessAvatar } from "@/components/app-shell/generated-avatar"

import { useSite, useSiteName } from "./site-context"

/** Garis kisi tipis dari token --border. Bentuk pudarnya diatur mask di className. */
export function GridPattern({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[4rem_4rem]",
        className,
      )}
    />
  )
}

/** Logo bisnis dari profilnya, atau avatar bisnis dari namanya. */
export function SiteLogo({ className }: { className?: string }) {
  const site = useSite()
  const name = useSiteName()
  if (site.logo_url) {
    return (
      <Image
        src={site.logo_url}
        alt=""
        width={32}
        height={32}
        unoptimized
        className={cn("size-8 rounded-md object-contain", className)}
      />
    )
  }
  return <BusinessAvatar seed={name} name={name} className={cn("size-8", className)} />
}

/**
 * Foto "Tentang kami" dari pengaturan website. Tidak dirender selama belum
 * ada fotonya: bidang kosong di halaman publik terbaca sebagai halaman yang
 * belum jadi.
 */
export function SitePhoto({ className }: { className?: string }) {
  const site = useSite()
  const name = useSiteName()
  if (!site.about.image_url) return null
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image src={site.about.image_url} alt={`Foto ${name}`} fill unoptimized className="object-cover" />
    </div>
  )
}

/** Label kecil, judul, dan satu kalimat di kepala setiap bagian halaman. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow: string
  title: string
  description?: string
  className?: string
}) {
  return (
    <div className={cn("flex max-w-2xl flex-col gap-3", className)}>
      {/* --primary di tema gelap terlalu gelap untuk teks; primary-foreground
          adalah indigo terang dari token yang sama. */}
      <p className="text-sm font-medium text-primary dark:text-primary-foreground">{eyebrow}</p>
      <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {description ? <p className="text-lg text-pretty text-muted-foreground">{description}</p> : null}
    </div>
  )
}
