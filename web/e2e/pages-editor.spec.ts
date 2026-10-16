import { expect, test } from "@playwright/test"

// Kerangka editor halaman (PROTOTIPE): tampilan panel kiri dipilih lewat ikon
// di kepala panel, dan pratinjau bisa diperbesar sampai ukuran sebenarnya.

test.beforeEach(async ({ page }) => {
  await page.goto(`/auth/login?as=administrator&next=${encodeURIComponent("/settings/pages/")}`)
  await page.getByRole("link", { name: "Beranda", exact: true }).first().click()
  await page.waitForURL(/\/settings\/pages\/edit\//)
})

test("ikon di kepala panel kiri mengganti tampilannya", async ({ page }) => {
  const views = page.getByRole("navigation", { name: "Panel editor" })
  await expect(page.getByRole("complementary", { name: "Blok" }).getByPlaceholder("Cari blok")).toBeVisible()

  await views.getByRole("button", { name: "Susunan" }).click()
  await expect(views.getByRole("button", { name: "Susunan" })).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("complementary", { name: "Susunan" })).toBeVisible()
  await expect(page.getByPlaceholder("Cari blok")).toBeHidden()

  await views.getByRole("button", { name: "AI", exact: true }).click()
  await expect(page.getByRole("complementary", { name: "Asisten AI" }).getByRole("tab", { name: "Otomatis" })).toBeVisible()

  // Yang diketik di pencarian blok tidak hilang saat berpindah tampilan.
  await views.getByRole("button", { name: "Blok" }).click()
  await page.getByPlaceholder("Cari blok").fill("harga")
  await views.getByRole("button", { name: "Komponen" }).click()
  await views.getByRole("button", { name: "Blok" }).click()
  await expect(page.getByPlaceholder("Cari blok")).toHaveValue("harga")
})

test("tampilan AI hanya menyisakan chat dan kanvas, sampai ada blok yang dipilih", async ({ page }) => {
  const views = page.getByRole("navigation", { name: "Panel editor" })
  const fields = page.getByRole("complementary", { name: "Isian blok" })
  const canvas = page.frameLocator("#preview-frame")
  const stage = page.locator("main")
  await expect(fields).toBeVisible()
  const before = (await stage.boundingBox())!.width

  // Blok yang sedang terpilih dilepas saat masuk ke chat, jadi panel isian tidak ikut tampil dan kanvas melebar.
  await canvas.getByRole("heading", { name: "Melayani sepenuh hati, setiap hari" }).click({ force: true })
  await expect(fields.getByText("Blok terpilih")).toBeVisible()
  await views.getByRole("button", { name: "AI", exact: true }).click()
  await expect(fields).toBeHidden()
  await expect(page.getByRole("complementary", { name: "Asisten AI" })).toBeVisible()
  expect((await stage.boundingBox())!.width).toBeGreaterThan(before)

  // Mengeklik blok di kanvas membuka panel isiannya, walaupun masih di tampilan AI.
  const chat = page.getByRole("complementary", { name: "Asisten AI" })
  const alone = (await chat.boundingBox())!.width
  await canvas.getByRole("heading", { name: "Melayani sepenuh hati, setiap hari" }).click({ force: true })
  await expect(fields.getByText("Blok terpilih")).toBeVisible()
  await expect(chat).toBeVisible()
  // Chat lebih lebar selama sendirian, dan menyempit lagi begitu panel isian terbuka.
  expect((await chat.boundingBox())!.width).toBeLessThan(alone)

  // Tombol panel di bilah atas tetap berlaku, sampai blok lain dipilih.
  await page.getByRole("button", { name: "Sembunyikan panel isian" }).click()
  await expect(fields).toBeHidden()
  await canvas.getByRole("heading", { name: "Yang bisa kami bantu" }).click({ force: true })
  await expect(fields.getByText("Blok terpilih")).toBeVisible()

  // Di tampilan lain panel isian mengikuti pilihan panel yang tersimpan, ada blok terpilih atau tidak.
  await views.getByRole("button", { name: "Blok" }).click()
  await expect(fields).toBeVisible()
})

test("mode coba menyembunyikan kedua panel, lalu mengembalikannya seperti semula", async ({ page }) => {
  const views = page.getByRole("navigation", { name: "Panel editor" })
  const outline = page.getByRole("complementary", { name: "Susunan" })
  const fields = page.getByRole("complementary", { name: "Isian blok" })
  await views.getByRole("button", { name: "Susunan" }).click()
  await expect(outline).toBeVisible()
  await expect(fields).toBeVisible()
  await expect(page.getByText("Mode coba", { exact: true })).toBeHidden()

  await page.getByRole("button", { name: /^Mode coba/ }).click()
  await expect(page.getByText("Mode coba", { exact: true })).toBeVisible()
  await expect(outline).toBeHidden()
  await expect(fields).toBeHidden()
  // Selama mencoba, kedua tombol panel mati.
  const toggles = page.getByRole("button", { name: "Panel disembunyikan selama mode coba" })
  await expect(toggles).toHaveCount(2)
  await expect(toggles.first()).toHaveAttribute("aria-disabled", "true")
  await expect(toggles.last()).toHaveAttribute("aria-disabled", "true")

  // Selesai mencoba: tampilan dan panel yang terakhir dipakai kembali.
  await page.getByRole("button", { name: "Selesai mencoba, kembali menyunting" }).click()
  await expect(page.getByText("Mode coba", { exact: true })).toBeHidden()
  await expect(outline).toBeVisible()
  await expect(fields).toBeVisible()
})

test("pratinjau bawaannya pas, dan bisa diperbesar sampai ukuran sebenarnya", async ({ page }) => {
  const zoom = page.getByRole("combobox", { name: "Zoom" })
  const stage = page.locator("main > div")
  const overflow = () => stage.evaluate((element) => element.scrollWidth - element.clientWidth)

  // Halaman 1280 px tidak muat di kanvas pada layar uji, jadi "pas" di bawah 100% dan tidak ada yang terpotong.
  await expect(zoom).toContainText("(pas)")
  await expect(zoom).not.toContainText("100%")
  expect(await overflow()).toBe(0)

  const enlarge = page.getByRole("button", { name: "Perbesar" })
  while (!(await zoom.innerText()).startsWith("100%")) await enlarge.click()
  await expect(enlarge).toHaveAttribute("aria-disabled", "true")
  // Ukuran sebenarnya lebih lebar dari kanvas: sisanya dicapai dengan menggulir ke samping.
  expect(await overflow()).toBeGreaterThan(0)

  // Mengganti perangkat mengembalikan pratinjau ke "pas".
  await page.getByRole("button", { name: "Ponsel" }).click()
  await page.getByRole("button", { name: "Komputer" }).click()
  await expect(zoom).toContainText("(pas)")
  expect(await overflow()).toBe(0)
})
