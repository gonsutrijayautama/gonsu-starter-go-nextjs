import { expect, test, type FrameLocator, type Locator, type Page } from "@playwright/test"

// Gradien bergerak di Tampilan bagian (PROTOTIPE): geraknya dipilih di panel,
// tampil di kanvas, dan berhenti bagi pengunjung yang meminta gerak dikurangi.

test.beforeEach(async ({ page }) => {
  await page.goto(`/auth/login?as=administrator&next=${encodeURIComponent("/settings/pages/")}`)
  await page.getByRole("link", { name: "Beranda", exact: true }).first().click()
  await page.waitForURL(/\/settings\/pages\/edit\//)
})

/** Membuka Tampilan blok pembuka dan memilih latar gradien. */
async function openGradient(page: Page): Promise<{ fields: Locator; canvas: FrameLocator }> {
  const fields = page.getByRole("complementary", { name: "Isian blok" })
  const canvas = page.frameLocator("#preview-frame")
  await canvas.getByRole("heading", { name: "Melayani sepenuh hati, setiap hari" }).click({ force: true })
  await fields.getByRole("tab", { name: "Tampilan" }).click()
  await fields.getByRole("button", { name: "Gradien dua warna" }).click()
  return { fields, canvas }
}

// Lapisan geraknya hiasan (aria-hidden), jadi tidak punya role: dicari lewat atribut datanya.
const layerOf = (canvas: FrameLocator, motion: string) => canvas.locator(`[data-gradient-motion="${motion}"]`)

const running = (layer: Locator) => layer.locator("span").first().evaluate((element) => element.getAnimations().length)

test("gerak gradien dipilih di Tampilan dan tampil di kanvas", async ({ page }) => {
  const { fields, canvas } = await openGradient(page)
  const direction = fields.getByRole("group", { name: "Arah" })

  // Bawaannya diam: tanpa lapisan gerak, dan arah gradien masih bisa dipilih.
  await expect(fields.getByRole("button", { name: "Diam" })).toHaveAttribute("aria-pressed", "true")
  await expect(canvas.locator("[data-gradient-motion]")).toHaveCount(0)
  await expect(direction).toBeVisible()

  for (const [label, motion] of [
    ["Awan melayang", "cloud"],
    ["Pusaran pelan", "swirl"],
    ["Sutra mengalir", "silk"],
  ] as const) {
    await fields.getByRole("button", { name: label }).click()
    await expect(canvas.locator("[data-gradient-motion]")).toHaveCount(1)
    await expect(layerOf(canvas, motion)).toHaveCount(1)
    expect(await running(layerOf(canvas, motion))).toBeGreaterThan(0)
    // Yang bergerak menutup seluruh bagian, jadi arah tidak ditawarkan.
    await expect(direction).toBeHidden()
  }

  // Lapisannya tidak pernah membuat halaman bergulir ke samping.
  expect(await canvas.locator("html").evaluate((element) => element.scrollWidth - element.clientWidth)).toBe(0)

  await fields.getByRole("button", { name: "Diam" }).click()
  await expect(canvas.locator("[data-gradient-motion]")).toHaveCount(0)
  await expect(direction).toBeVisible()
})

test("gerak gradien berhenti bagi pengunjung yang meminta gerak dikurangi", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  const { fields, canvas } = await openGradient(page)

  await fields.getByRole("button", { name: "Sutra mengalir" }).click()
  // Warnanya tetap tampil, hanya tidak bergerak.
  await expect(layerOf(canvas, "silk")).toHaveCount(1)
  expect(await running(layerOf(canvas, "silk"))).toBe(0)
})
