import { cn } from "cn"

import { sections } from "@/lib/navigation"
import { product } from "@/lib/product"
import { BusinessAvatar } from "@/components/app-shell/generated-avatar"
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame"
import { IconTile } from "@/components/reui/icon-tile"

/**
 * Cuplikan aplikasi di hero: miniatur dasbor yang disusun dari menu sungguhan
 * (lib/navigation.tsx), jadi ikut berubah saat modul baru ditambahkan.
 *
 * Hiasan saja — aria-hidden dan tanpa tautan. Tidak ada data pengguna di
 * sini: halaman depan tidak boleh memanggil API.
 */
export function AppPreview({ className }: { className?: string }) {
  const homeItems = sections[0]?.groups.flatMap((group) => group.items) ?? []
  // Kartu dasbor: menu yang punya keterangan, sama dengan dashboard.tsx.
  const cards = sections
    .flatMap((section) => section.groups.flatMap((group) => group.items))
    .filter((item) => item.description)

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none select-none [mask-image:linear-gradient(to_bottom,black_55%,transparent)]",
        className,
      )}
    >
      <div className="rounded-3xl border bg-muted/60 p-2.5 shadow-2xl">
        <div className="flex h-160 overflow-hidden rounded-xl border bg-sidebar text-sidebar-foreground">
          <div className="flex w-50 shrink-0 flex-col gap-2 p-2">
            <div className="flex h-12 items-center gap-2 px-2">
              <BusinessAvatar seed={product.code} name={product.name} className="size-8" />
              <span className="truncate text-sm font-semibold">{product.name}</span>
            </div>
            <ul className="flex flex-col gap-0.5">
              {homeItems.map((item, index) => (
                <li
                  key={item.url}
                  className={cn(
                    "flex h-8 items-center gap-2 rounded-md px-2 text-sm [&_svg]:size-4",
                    index === 0 && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                  )}
                >
                  {item.icon}
                  <span className="truncate">{item.title}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-4 px-4 pb-4">
            <div className="flex h-16 shrink-0 items-center text-sm">{homeItems[0]?.title}</div>
            <div className="space-y-1">
              <div className="text-2xl font-semibold tracking-tight">Halo</div>
              <p className="text-sm text-muted-foreground">Mau mulai dari mana hari ini?</p>
            </div>
            <Frame className="w-full">
              <FrameHeader>
                <FrameTitle>Menu</FrameTitle>
                <FrameDescription>Semua yang bisa Anda buka di aplikasi ini.</FrameDescription>
              </FrameHeader>
              <div className="grid grid-cols-2 gap-0.5">
                {cards.map((item) => (
                  <FramePanel key={item.url} className="flex items-start gap-3">
                    <IconTile>{item.icon}</IconTile>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">{item.title}</div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </FramePanel>
                ))}
              </div>
            </Frame>
          </div>
        </div>
      </div>
    </div>
  )
}
