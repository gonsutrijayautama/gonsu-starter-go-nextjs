import { expect, test, type Page } from "@playwright/test"

async function signIn(page: Page, role: "administrator" | "staff" | "viewer", next: string) {
  await page.goto(`/auth/login?as=${role}&next=${encodeURIComponent(next)}`)
}

test("bawaannya halaman depan hanya pintu masuk", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("link", { name: "Masuk", exact: true }).first()).toBeVisible()
  // Belum ada web perusahaan: tidak ada bagian layanan maupun kontak.
  await expect(page.getByRole("heading", { name: "Mampir atau hubungi kami" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Hubungi kami" })).toHaveCount(0)
})

test("administrator menyalakan web perusahaan, dan pengunjung melihatnya tanpa masuk", async ({ page, browser }) => {
  const tagline = `Melayani sepenuh hati ${Date.now()}`
  await signIn(page, "administrator", "/settings/website/")
  await expect(page.getByRole("heading", { name: "Website", exact: true })).toBeVisible()

  await page.getByRole("radio", { name: /Web perusahaan/ }).click()
  await page.getByLabel("Tagline").fill(tagline)
  await page.getByRole("button", { name: "Tambah layanan" }).click()
  await page.getByLabel("Nama layanan").fill("Konsultasi")
  await page.getByLabel("Keterangan").fill("Bicarakan kebutuhan Anda dengan tim kami.")
  await page.getByLabel("Jam kerja").fill("Senin–Sabtu 09.00–17.00")
  await page.getByLabel("WhatsApp").fill("0812-3456-7890")
  await page.getByRole("button", { name: "Simpan" }).click()
  await expect(page.getByRole("heading", { name: "Pengaturan website disimpan" })).toBeVisible()

  // Sesudah dimuat ulang, isian menampilkan yang disimpan server.
  await page.reload()
  await expect(page.getByLabel("Tagline")).toHaveValue(tagline)
  await expect(page.getByLabel("WhatsApp")).toHaveValue("6281234567890")

  // Pengunjung tanpa akun: konteks baru tanpa cookie.
  const anonymous = await browser.newContext()
  const visitor = await anonymous.newPage()
  await visitor.goto("/")
  await expect(visitor.getByRole("heading", { level: 1, name: tagline })).toBeVisible()
  await expect(visitor.getByRole("heading", { name: "Konsultasi" })).toBeVisible()
  await expect(visitor.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/6281234567890")
  // Judul tab datang dari data bisnis, bukan dari build.
  await expect(visitor).toHaveTitle(new RegExp(tagline))
  // Server menyisipkan judul dan pratinjau tautan ke HTML-nya sendiri, untuk
  // layanan yang tidak menjalankan JavaScript.
  const html = await (await anonymous.request.get("/")).text()
  expect(html).toContain(`<meta property="og:title"`)
  expect(html).toContain(tagline)
  await anonymous.close()
})

test("staf tidak bisa mengatur website: layarnya menolak, dan server menolak", async ({ page }) => {
  await signIn(page, "staff", "/settings/website/")
  await expect(page.getByRole("heading", { name: "Website", exact: true })).toBeVisible()
  await expect(page.getByText("Role Anda belum bisa mengatur website.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Simpan" })).toHaveCount(0)

  // Menyembunyikan formulir bukan penjagaan; yang menjaga server.
  const status = await page.evaluate(async () => {
    const res = await fetch("/v1/website", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "site", version: 0 }),
    })
    return res.status
  })
  expect(status).toBe(403)
})
