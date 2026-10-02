import type { Metadata } from "next"
import Link from "next/link"
import { cn } from "cn"
import { CompassIcon } from "lucide-react"

import { IconStack } from "@/components/reui/icon-stack"
import { buttonVariants } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export const metadata: Metadata = { title: "Halaman tidak ditemukan" }

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <IconStack aria-hidden="true">
              <CompassIcon className="size-4" />
            </IconStack>
          </EmptyMedia>
          <EmptyTitle>Halaman ini tidak ada</EmptyTitle>
          <EmptyDescription>Alamatnya mungkin salah ketik, atau halamannya sudah dipindah.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link href="/dashboard/" className={cn(buttonVariants())}>
            Ke dasbor
          </Link>
        </EmptyContent>
      </Empty>
    </main>
  )
}
