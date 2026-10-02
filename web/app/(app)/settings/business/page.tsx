import type { Metadata } from "next"

import { BusinessScreen } from "./business-screen"

export const metadata: Metadata = { title: "Profil bisnis" }

export default function BusinessPage() {
  return <BusinessScreen />
}
