import Image from "next/image"
import { ImageIcon } from "lucide-react"
import { cn } from "cn"

import { site } from "@/lib/site"
import { BusinessAvatar } from "@/components/app-shell/generated-avatar"

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

/** Logo tenant: berkas `site.logo`, atau avatar bisnis dari namanya. */
export function SiteLogo({ className }: { className?: string }) {
  if (site.logo) {
    return (
      <Image
        src={site.logo}
        alt=""
        width={32}
        height={32}
        unoptimized
        className={cn("size-8 rounded-md object-contain", className)}
      />
    )
  }
  return <BusinessAvatar seed={site.name} name={site.name} className={cn("size-8", className)} />
}

/**
 * Foto perusahaan dari `site.about.image`. Selama belum diisi, bidangnya
 * menandai tempat foto — bukan gambar stok yang pura-pura milik tenant.
 */
export function SitePhoto({ label, className }: { label: string; className?: string }) {
  if (site.about.image) {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <Image src={site.about.image} alt={`Foto ${site.name}`} fill unoptimized className="object-cover" />
      </div>
    )
  }
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 bg-muted/70 bg-[repeating-linear-gradient(45deg,var(--border)_0_1px,transparent_1px_12px)] text-sm text-muted-foreground",
        className,
      )}
    >
      <ImageIcon aria-hidden="true" className="size-6" />
      {label}
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
