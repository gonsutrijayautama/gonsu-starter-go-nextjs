import type { Metadata } from "next"

import { EditorScreen } from "./editor-screen"

export const metadata: Metadata = { title: "Susun halaman" }

export default function Page() {
  return <EditorScreen />
}
