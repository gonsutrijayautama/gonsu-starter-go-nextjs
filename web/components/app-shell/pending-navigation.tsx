"use client"

import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { PageLoading } from "./page-loading"

interface PendingNavigationValue {
  /**
   * Pindah ke `href` dan tandai `target` sebagai yang sedang dimuat sampai
   * halamannya tiba. `target` kosong berarti perpindahan tanpa tanda memuat,
   * misalnya menutup sheet.
   */
  navigate: (href: string, target?: string) => void
  /** Target perpindahan yang masih berjalan; null bila tidak ada. */
  pendingTarget: string | null
}

const PendingNavigationContext = createContext<PendingNavigationValue | null>(null)

/**
 * Tanda memuat untuk perpindahan yang hanya mengganti parameter alamat.
 *
 * `loading.tsx` Next hanya menyala bila SEGMEN berganti. Halaman yang
 * keadaannya di alamat (`?product=`, `?release=`) tidak pernah mengganti
 * segmen, jadi tanpa ini halaman lama diam tanpa tanda apa pun sampai halaman
 * baru selesai dimuat. Perpindahannya dijalankan di dalam transition, dan
 * bagian yang menunggu menampilkan `PageLoading` yang sama dengan loading.tsx.
 */
export function PendingNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [target, setTarget] = useState<string | null>(null)

  const navigate = useCallback(
    (href: string, next?: string) => {
      setTarget(next ?? null)
      startTransition(() => router.push(href, { scroll: false }))
    },
    [router],
  )

  const value = useMemo(
    () => ({ navigate, pendingTarget: isPending ? target : null }),
    [navigate, isPending, target],
  )

  return <PendingNavigationContext value={value}>{children}</PendingNavigationContext>
}

export function usePendingNavigation(): PendingNavigationValue {
  const value = use(PendingNavigationContext)
  if (!value) throw new Error("usePendingNavigation harus dipakai di dalam PendingNavigationProvider")
  return value
}

export interface PendingContentProps {
  /** Target yang, selama dimuat, mengganti isi ini dengan tanda memuat. */
  target: string
  label?: string
  className?: string
  children: ReactNode
}

/** Isi yang diganti `PageLoading` selama perpindahan ke `target` berjalan. */
export function PendingContent({ target, label, className, children }: PendingContentProps) {
  const { pendingTarget } = usePendingNavigation()
  return pendingTarget === target ? <PageLoading label={label} className={className} /> : children
}

export interface PendingLinkProps extends Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> {
  href: string
  /**
   * Target yang ditandai memuat; lihat `navigate`. Bukan `target` karena nama
   * itu milik atribut `<a target>`.
   */
  loadingTarget?: string
}

/**
 * Link yang perpindahannya ikut ditandai memuat. Klik tengah dan Ctrl+klik
 * tetap membuka tab baru seperti Link biasa: `onNavigate` hanya dipanggil
 * untuk perpindahan di dalam halaman.
 */
export function PendingLink({ href, loadingTarget, ...props }: PendingLinkProps) {
  const { navigate } = usePendingNavigation()
  return (
    <Link
      href={href}
      scroll={false}
      onNavigate={(event) => {
        event.preventDefault()
        navigate(href, loadingTarget)
      }}
      {...props}
    />
  )
}
