import { expect, test, type Page } from "@playwright/test"

// Contoh bawaan blok (PROTOTIPE penyusun halaman). Tidak ada nama, angka,
// rating, harga, atau penghargaan karangan: isian yang belum diisi ditandai
// petunjuk di editor, dan tidak dirender bagi pengunjung. Blok dipasang lewat
// asisten AI dengan isian kosong, sehingga pengimpornya — yang melengkapi
// isian yang dilewati model dari contoh bawaan — ikut teruji.

/** Editor halaman baru; asisten AI menjawab dengan `events`, apa adanya. */
async function openWithBlocks(page: Page, items: { type: string; props: Record<string, unknown> }[]) {
  await page.route(
    (url) => url.pathname === "/v1/page-ai",
    (route) => route.fulfill({ json: { data: { configured: true, model: "uji/model" } } })
  )
  const events = [...items.map((item) => ({ type: "insert", item })), { type: "text", text: "Sudah saya susun." }, { type: "done" }]
  await page.route(
    (url) => url.pathname === "/v1/page-ai/replies",
    (route) => route.fulfill({ contentType: "application/x-ndjson", body: events.map((event) => JSON.stringify(event) + "\n").join("") })
  )

  await page.goto(`/auth/login?as=administrator&next=${encodeURIComponent("/settings/pages/")}`)
  await page.getByRole("button", { name: "Buat halaman" }).click()
  const dialog = page.getByRole("dialog", { name: "Buat halaman" })
  await dialog.getByLabel("Judul").fill(`Uji contoh bawaan ${Date.now()}`)
  await dialog.getByRole("button", { name: "Buat dan susun isinya" }).click()
  await page.waitForURL(/\/settings\/pages\/edit\//)
  await page.getByRole("button", { name: "AI", exact: true }).click()
  const panel = page.getByRole("complementary", { name: "Asisten AI" })
  await panel.getByLabel("Pesan untuk asisten halaman").fill("Susun halamannya")
  await panel.getByLabel("Pesan untuk asisten halaman").press("Enter")
  await expect(panel.getByText("Sudah saya susun.")).toBeVisible()
  const canvas = page.frameLocator("#preview-frame")
  await expect(canvas.locator("[data-puck-component]")).toHaveCount(items.length)
  return { canvas }
}

test("blok bukti tanpa isi ditandai di editor, tanpa data karangan, dan tidak tampil bagi pengunjung", async ({ page }) => {
  const { canvas } = await openWithBlocks(page, [
    { type: "Hero", props: { title: "Selamat datang" } },
    { type: "Testimonials", props: {} },
    { type: "Reviews", props: {} },
    { type: "Awards", props: {} },
    { type: "Stats", props: {} },
  ])

  // Di editor setiap isian kosong punya petunjuk, supaya bentuk bloknya tetap terlihat. Isian yang bisa
  // diketik langsung membawa petunjuknya sebagai atribut (ditampilkan CSS), yang lain sebagai teks.
  await expect(canvas.locator("[data-inline-hint='Nama pelanggan']").first()).toBeVisible()
  await expect(canvas.locator("[data-inline-hint='Nama penghargaan']").first()).toBeVisible()
  await expect(canvas.getByText("Label angka").first()).toBeVisible()
  // Contoh bawaan tidak memuat apa pun yang terbaca sebagai fakta usaha.
  const body = canvas.locator("body")
  for (const invented of ["Google", "UMKM", "4,8", "4,9", "5.000", "2015", "Rp"]) {
    await expect(body).not.toContainText(invented)
  }

  // Mode coba merender halaman seperti yang dilihat pengunjung: blok kosong tidak dirender sama sekali.
  await page.getByRole("button", { name: /^Mode coba/ }).click()
  await expect(page.getByText("Mode coba", { exact: true })).toBeVisible()
  await expect(canvas.getByRole("heading", { name: "Selamat datang" })).toBeVisible()
  for (const heading of ["Kata pelanggan", "Apa kata pelanggan", "Penghargaan dan sertifikat", "Angka yang bicara"]) {
    await expect(canvas.getByRole("heading", { name: heading })).toHaveCount(0)
  }
  await expect(canvas.locator("[data-inline-hint]")).toHaveCount(0)
})

test("blok berisi orang dan galeri tanpa isi tidak tampil bagi pengunjung, isian yang diisi tampil", async ({ page }) => {
  const { canvas } = await openWithBlocks(page, [
    { type: "Team", props: {} },
    { type: "Gallery", props: {} },
    {
      type: "Testimonials",
      props: { title: "Pelanggan bercerita", items: [{ quote: "Pelayanannya ramah.", name: "Dewi", role: "", rating: 0, image: null }] },
    },
  ])
  await expect(canvas.locator("[data-inline-hint='Peran']").first()).toBeVisible()

  await page.getByRole("button", { name: /^Mode coba/ }).click()
  await expect(page.getByText("Mode coba", { exact: true })).toBeVisible()
  await expect(canvas.getByRole("heading", { name: "Kenali tim kami" })).toHaveCount(0)
  await expect(canvas.getByRole("heading", { name: "Galeri" })).toHaveCount(0)
  // Yang diisi tetap tampil, tanpa petunjuk dari isian lain yang masih kosong.
  await expect(canvas.getByRole("heading", { name: "Pelanggan bercerita" })).toBeVisible()
  await expect(canvas.getByText("Pelayanannya ramah.")).toBeVisible()
  await expect(canvas.locator("[data-inline-hint]")).toHaveCount(0)
})
