import { expect, test, type Page } from "@playwright/test"

// Chat AI di editor halaman (PROTOTIPE). Penyusunnya masih simulasi
// (components/pages/ai/simulate.ts) dan data halaman ada di penyimpanan
// peramban, jadi setiap tes mulai dari data contoh yang sama.

async function openEditor(page: Page) {
  await page.goto(`/auth/login?as=administrator&next=${encodeURIComponent("/settings/pages/")}`)
  await page.getByRole("button", { name: "Buat halaman" }).click()
  const dialog = page.getByRole("dialog", { name: "Buat halaman" })
  await dialog.getByLabel("Judul").fill(`Uji AI ${Date.now()}`)
  await dialog.getByRole("button", { name: "Buat dan susun isinya" }).click()
  await page.waitForURL(/\/settings\/pages\/edit\//)
  await page.getByRole("button", { name: "AI", exact: true }).click()
  const panel = page.getByRole("complementary", { name: "Asisten AI" })
  await expect(panel.getByRole("heading", { name: "Asisten halaman" })).toBeVisible()
  return { panel, blocks: page.frameLocator("#preview-frame").locator("[data-puck-component]") }
}

test("halaman kosong disusun dari contoh permintaan, lalu bisa diurungkan", async ({ page }) => {
  const { panel, blocks } = await openEditor(page)
  await expect(blocks).toHaveCount(0)

  await panel.getByRole("button", { name: "Beranda", exact: true }).click()
  await expect(panel.getByText("Buatkan halaman beranda untuk usaha saya")).toBeVisible()
  await expect(panel.getByText("8 bagian disusun")).toBeVisible()
  await expect(panel.getByText(/Halaman sudah saya susun: 8 bagian/)).toBeVisible()
  await expect(blocks).toHaveCount(8)
  // Belum tersimpan: hasil AI adalah draf di editor.
  await expect(page.getByRole("button", { name: "Simpan draf" })).not.toHaveAttribute("aria-disabled", "true")

  await panel.getByRole("button", { name: "Urungkan perubahan ini" }).click()
  await expect(blocks).toHaveCount(0)
  await expect(panel.getByRole("button", { name: "Urungkan perubahan ini" })).toHaveCount(0)
})

test("permintaan lanjutan menambah dan membuang bagian", async ({ page }) => {
  const { panel, blocks } = await openEditor(page)
  const input = panel.getByLabel("Pesan untuk asisten halaman")
  // Pesan baru hanya diterima sesudah jawaban sebelumnya selesai: tombol kirim kembali tampil.
  const send = async (text: string) => {
    await expect(panel.getByRole("button", { name: "Kirim" })).toBeVisible()
    await input.fill(text)
    await input.press("Enter")
  }

  await send("Buatkan halaman kontak dan lokasi")
  await expect(panel.getByText("4 bagian disusun")).toBeVisible()
  await expect(blocks).toHaveCount(4)

  await send("Tambahkan galeri foto dan promo")
  await expect(panel.getByText(/Bagian Galeri dan Promo sudah saya tambahkan/)).toBeVisible()
  await expect(blocks).toHaveCount(6)

  await send("Hapus promo")
  await expect(panel.getByText(/Bagian Promo sudah saya buang/)).toBeVisible()
  await expect(blocks).toHaveCount(5)

  // Permintaan yang tidak dikenali simulasi tidak menyentuh halaman.
  await send("Ganti warnanya jadi biru")
  await expect(panel.getByText(/Simulasi ini baru mengerti tiga permintaan/)).toBeVisible()
  await expect(blocks).toHaveCount(5)
})

test("jawaban yang dihentikan menyisakan bagian yang sudah tersusun", async ({ page }) => {
  const { panel, blocks } = await openEditor(page)

  await panel.getByRole("button", { name: "Beranda", exact: true }).click()
  await expect(blocks).not.toHaveCount(0)
  await panel.getByRole("button", { name: "Hentikan" }).click()

  await expect(panel.getByText("Dihentikan. Bagian yang sudah tersusun tetap di halaman.")).toBeVisible()
  await expect(panel.getByRole("button", { name: "Kirim" })).toBeVisible()
  const built = await blocks.count()
  expect(built).toBeGreaterThan(0)
  expect(built).toBeLessThan(8)
})
