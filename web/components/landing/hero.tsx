import { ArrowRightIcon, ClockIcon, MapPinIcon, PhoneIcon, type LucideIcon } from "lucide-react"
import { cn } from "cn"

import { phoneHref, site } from "@/lib/site"
import { buttonVariants } from "@/components/ui/button"

import { AppPreview } from "./app-preview"
import { GridPattern } from "./decor"
import { SignInCard } from "./sign-in-card"

/**
 * Pembuka halaman: kiri untuk pengunjung (siapa perusahaannya dan cara
 * menghubunginya), kanan untuk pengguna aplikasi (kartu Masuk di atas
 * cuplikan dasbor). Di layar sempit cuplikannya disembunyikan.
 */
export function Hero() {
  const phone = phoneHref(site.contact.phone)

  return (
    <section className="relative overflow-hidden">
      <GridPattern className="[mask-image:radial-gradient(ellipse_70%_80%_at_70%_0%,black_20%,transparent_70%)]" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pt-16 pb-20 sm:px-6 lg:min-h-176 lg:grid-cols-2 lg:gap-8 lg:pt-24 lg:pb-0">
        <div className="flex flex-col items-start">
          <span className="inline-flex h-7 items-center gap-2 rounded-full border bg-background px-3 text-xs text-muted-foreground shadow-xs">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
            {site.industry} · {site.contact.city}
          </span>
          <h1 className="mt-6 text-4xl leading-[1.06] font-semibold tracking-tighter text-balance sm:text-5xl lg:text-[3.5rem]">
            Satu alamat untuk pelanggan, mitra, dan tim {site.name}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
            Kenali layanan kami dan hubungi tim kami dari sini. Sudah diberi akses ke aplikasi? Langsung masuk
            dengan akun GONSU Anda.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#layanan" className={cn(buttonVariants({ variant: "outline" }))}>
              Lihat layanan
            </a>
            <a href="#kontak" className={cn(buttonVariants({ variant: "ghost" }))}>
              Hubungi kami
              <ArrowRightIcon data-icon="inline-end" />
            </a>
          </div>
          <ul className="mt-12 flex w-full flex-wrap gap-x-6 gap-y-3 border-t pt-6 text-sm text-muted-foreground">
            <Fact icon={MapPinIcon}>{site.contact.city}</Fact>
            <Fact icon={PhoneIcon}>
              {phone ? (
                <a href={phone} className="underline-offset-4 hover:underline">
                  {site.contact.phone}
                </a>
              ) : (
                site.contact.phone
              )}
            </Fact>
            <Fact icon={ClockIcon}>{site.contact.hours}</Fact>
          </ul>
        </div>
        <div className="relative">
          <AppPreview className="absolute top-0 left-18 hidden w-210 lg:block" />
          <SignInCard className="lg:absolute lg:top-60 lg:left-0 lg:w-90" />
        </div>
      </div>
    </section>
  )
}

function Fact({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {children}
    </li>
  )
}
