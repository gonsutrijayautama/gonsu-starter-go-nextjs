import type { Metadata } from "next"

import { PagesScreen } from "./pages-screen"

export const metadata: Metadata = { title: "Halaman" }

export default function Page() {
  return <PagesScreen />
}
