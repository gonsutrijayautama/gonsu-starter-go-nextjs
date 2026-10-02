import type { Metadata } from "next"

import { LicenseScreen } from "./license-screen"

export const metadata: Metadata = { title: "Lisensi" }

export default function LicensePage() {
  return <LicenseScreen />
}
