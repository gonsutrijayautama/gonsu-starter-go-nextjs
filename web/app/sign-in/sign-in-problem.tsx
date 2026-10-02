"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { cn } from "cn"

import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame"
import { buttonVariants } from "@/components/ui/button"

type Problem = {
  title: string
  description: string
  action: { label: string; href: string }
}

const signInAgain = { label: "Masuk lagi", href: "/auth/login" }

// Sebab dari server Go (internal/authn/login.go). Server hanya menyebut
// sebabnya; kalimatnya disusun di sini.
const problems: Record<string, Problem> = {
  "not-granted": {
    title: "Akun ini belum punya akses",
    description:
      "Anda berhasil masuk ke GONSU, tapi akun ini belum diberi akses ke aplikasi ini. Minta administrator menambahkan Anda di Pengguna & Akses, atau masuk dengan akun lain.",
    action: { label: "Masuk dengan akun lain", href: "/auth/gonsu/switch-account" },
  },
  expired: {
    title: "Proses masuk kedaluwarsa",
    description: "Halaman masuk dibiarkan terlalu lama. Coba masuk sekali lagi.",
    action: signInAgain,
  },
  unreachable: {
    title: "GONSU belum bisa dihubungi",
    description: "Layanan masuk sedang tidak terjangkau. Tunggu sebentar, lalu coba lagi.",
    action: signInAgain,
  },
  "not-configured": {
    title: "Masuk belum disiapkan",
    description: "Pemasangan ini belum terhubung ke layanan masuk GONSU. Hubungi yang memasang aplikasi ini.",
    action: signInAgain,
  },
  rejected: {
    title: "Masuk tidak berhasil",
    description: "Ada yang tidak cocok saat menyelesaikan proses masuk. Coba lagi.",
    action: signInAgain,
  },
}

// Tanpa ?error= halaman ini sekadar halaman masuk.
const plainSignIn: Problem = {
  title: "Masuk",
  description: "Masuk pakai akun GONSU Anda.",
  action: { label: "Masuk", href: "/auth/login" },
}

export function SignInProblem() {
  const error = useSearchParams().get("error")
  const problem = error ? (problems[error] ?? problems.rejected) : plainSignIn

  return (
    <Frame className="w-full max-w-sm">
      <FramePanel>
        <FrameHeader className="px-0 pt-0">
          <FrameTitle>{problem.title}</FrameTitle>
          <FrameDescription>{problem.description}</FrameDescription>
        </FrameHeader>
        <FrameFooter className="flex flex-col gap-2 px-0 pb-0">
          {/* Jalur /auth/* dilayani server Go: <a> bergaya tombol, bukan Button. */}
          <a href={problem.action.href} className={cn(buttonVariants(), "w-full")}>
            {problem.action.label}
          </a>
          <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "w-full")}>
            Kembali ke awal
          </Link>
        </FrameFooter>
      </FramePanel>
    </Frame>
  )
}
