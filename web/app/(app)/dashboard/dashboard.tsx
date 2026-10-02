"use client"

import Link from "next/link"

import { sections } from "@/lib/navigation"
import { PageHeader } from "@/components/page-header"
import { useCan, useSession } from "@/components/session-provider"
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame"
import { IconTile } from "@/components/reui/icon-tile"

// Kartu menu di dasbor: SATU Frame berisi beberapa FramePanel, bukan satu
// Frame per kartu (docs/ui-guide.md). Menu tampil bila punya keterangan dan
// pengguna memegang izinnya.
export function Dashboard() {
  const me = useSession()
  const can = useCan()
  const items = sections
    .flatMap((section) => section.groups.flatMap((group) => group.items))
    .filter((item) => item.description && (!item.permission || can(item.permission)))

  return (
    <>
      <PageHeader title={`Halo, ${me.name}`} description="Mau mulai dari mana hari ini?" />
      <Frame className="w-full">
        <FrameHeader>
          <FrameTitle>Menu</FrameTitle>
          <FrameDescription>Semua yang bisa Anda buka di aplikasi ini.</FrameDescription>
        </FrameHeader>
        <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <FramePanel key={item.url} className="flex items-start gap-3 transition-colors hover:bg-muted/50">
              <IconTile aria-hidden="true">{item.icon}</IconTile>
              <div className="space-y-1">
                <h2 className="text-sm font-semibold">
                  {/* FramePanel sudah `relative`: seluruh panel jadi tautan lewat
                      anchor absolute inset-0. */}
                  <Link href={item.url} className="after:absolute after:inset-0">
                    {item.title}
                  </Link>
                </h2>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            </FramePanel>
          ))}
        </div>
      </Frame>
    </>
  )
}
