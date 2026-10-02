"use client"

import { Fragment } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export interface AppBreadcrumbProps {
  /** Nama yang dibaca orang untuk setiap segmen alamat. */
  labels: Record<string, string>
  /** Alamat yang benar-benar halaman; segmen lain tampil tanpa tautan. */
  pages: string[]
}

/**
 * Breadcrumb yang diturunkan dari alamat, BUKAN diisi tiap halaman: breadcrumb
 * yang dipasang manual adalah breadcrumb yang halaman kesebelas lupa
 * memasangnya. Seluruh jejaknya tampil di semua lebar layar — ia satu-satunya
 * jalan naik (PageHeader tidak memuat tautan kembali).
 */
export function AppBreadcrumb({ labels, pages }: AppBreadcrumbProps) {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)
  const known = new Set(pages.map((page) => page.replace(/\/$/, "")))

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join("/")}`
          const label = labels[segment] ?? segment
          const last = index === segments.length - 1
          return (
            <Fragment key={href}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem>
                {last ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : known.has(href) ? (
                  <BreadcrumbLink render={<Link href={`${href}/`} />}>{label}</BreadcrumbLink>
                ) : (
                  <span>{label}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
