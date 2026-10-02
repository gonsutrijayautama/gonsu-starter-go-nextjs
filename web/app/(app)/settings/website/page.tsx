import type { Metadata } from "next"

import { WebsiteScreen } from "./website-screen"

export const metadata: Metadata = { title: "Website" }

export default function WebsitePage() {
  return <WebsiteScreen />
}
