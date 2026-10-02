import { Suspense } from "react"
import type { Metadata } from "next"

import { SignInProblem } from "./sign-in-problem"

export const metadata: Metadata = { title: "Masuk" }

// Tujuan server Go bila login tidak bisa diselesaikan: /sign-in/?error=<sebab>.
// Seperti "/", halaman ini publik dan tidak memanggil API.
export default function SignInPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-sidebar p-6">
      {/* useSearchParams pada static export wajib di dalam Suspense. */}
      <Suspense>
        <SignInProblem />
      </Suspense>
    </main>
  )
}
