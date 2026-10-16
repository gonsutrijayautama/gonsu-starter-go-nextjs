import { expect, test, type FrameLocator, type Locator, type Page } from "@playwright/test"

// Teks yang diketik langsung di kanvas editor (PROTOTIPE penyusun halaman,
// `contentEditable` Puck). Di editor Puck mengganti isian itu dengan elemen
// yang bisa diketik; bagi pengunjung dan di Mode coba tetap teks biasa.
// Uji ini juga mengunci properti internal Puck yang dibaca `textOf`
// (components/pages/blocks.tsx): bila Puck naik versi dan ini gagal, periksa
// lagi pembantu itu.

type Item = { type: string; props: Record<string, unknown> }

/** Editor halaman baru berisi `items`, dipasang lewat asisten AI tiruan; panel AI ditutup lagi. */
async function openWith(page: Page, items: Item[]) {
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
  await dialog.getByLabel("Judul").fill(`Uji ketik langsung ${Date.now()}`)
  await dialog.getByRole("button", { name: "Buat dan susun isinya" }).click()
  await page.waitForURL(/\/settings\/pages\/edit\//)
  // Pemberitahuan "Halaman … dibuat" menutupi bilah atas (tombol Urungkan) sampai ia hilang sendiri.
  await expect(page.getByText(/^Halaman .* dibuat$/)).toBeHidden({ timeout: 15000 })
  await page.getByRole("button", { name: "AI", exact: true }).click()
  const panel = page.getByRole("complementary", { name: "Asisten AI" })
  await panel.getByLabel("Pesan untuk asisten halaman").fill("Susun halamannya")
  await panel.getByLabel("Pesan untuk asisten halaman").press("Enter")
  await expect(panel.getByText("Sudah saya susun.")).toBeVisible()
  await page.getByRole("button", { name: "AI", exact: true }).click()
  const canvas = page.frameLocator("#preview-frame")
  const blocks = canvas.locator("[data-puck-component]")
  await expect(blocks).toHaveCount(items.length)
  const fields = page.getByRole("complementary", { name: "Isian blok" })
  return { canvas, blocks, fields }
}

/** Mengganti seluruh isi teks yang bisa diketik langsung. */
async function retype(page: Page, target: Locator, text: string) {
  await target.hover()
  await target.click()
  await page.keyboard.press("ControlOrMeta+A")
  await page.keyboard.type(text)
}

function editableIn(canvas: FrameLocator, scope: string) {
  return canvas.locator(`${scope} [contenteditable]`).first()
}

test("judul diketik langsung di kanvas: panel ikut berubah, tersimpan, dan teks biasa bagi pengunjung", async ({ page }) => {
  const { canvas, fields } = await openWith(page, [{ type: "Features", props: { title: "Judul lama" } }])
  const title = editableIn(canvas, "h2")
  await retype(page, title, "Keunggulan usaha kami")
  // Judul satu baris: Enter tidak membuat baris baru.
  await page.keyboard.press("Enter")
  await expect(canvas.getByRole("heading", { name: "Keunggulan usaha kami" })).toBeVisible()
  await expect(fields.getByLabel("Judul bagian")).toHaveValue("Keunggulan usaha kami")

  await page.getByRole("button", { name: "Simpan draf" }).click()
  await expect(page.getByText("Draf disimpan")).toBeVisible()
  await page.reload()
  await expect(canvas.getByRole("heading", { name: "Keunggulan usaha kami" })).toBeVisible()

  // Mode coba merender seperti halaman terbit: tidak ada yang bisa diketik.
  await page.getByRole("button", { name: /^Mode coba/ }).click()
  await expect(page.getByText("Mode coba", { exact: true })).toBeVisible()
  await expect(canvas.getByRole("heading", { name: "Keunggulan usaha kami" })).toBeVisible()
  await expect(canvas.locator("[contenteditable]")).toHaveCount(0)
})

test("isian kosong menjadi tempat mengetik berpetunjuk, juga di butir daftar", async ({ page }) => {
  const { canvas, fields } = await openWith(page, [{ type: "Features", props: { title: "" } }])
  await expect(canvas.locator("[data-inline-hint='Judul bagian']")).toBeVisible()

  // Judul butir pertama: diketik di kanvas, tampil di butir daftar di panel.
  const first = canvas.locator("[data-puck-component] li").first()
  await retype(page, first.locator("[contenteditable]").first(), "Respons cepat")
  await expect(first).toContainText("Respons cepat")
  await expect(fields.getByText("Respons cepat").first()).toBeVisible()
})

test("Backspace dan Delete di dalam teks tidak menghapus blok, dan urungkan mengembalikan teksnya", async ({ page }) => {
  const { canvas, blocks } = await openWith(page, [
    { type: "Features", props: { title: "Satu dua" } },
    { type: "Text", props: { title: "Cerita", body: "<p>Paragraf pertama.</p>" } },
  ])
  const title = editableIn(canvas, "h2")
  await title.hover()
  await title.click()
  await page.keyboard.press("End")
  await page.keyboard.press("Backspace")
  await page.keyboard.press("Home")
  await page.keyboard.press("Delete")
  await expect(blocks).toHaveCount(2)
  await expect(canvas.getByRole("heading", { name: "atu du" })).toBeVisible()

  // Teks kaya: tebal dengan Ctrl+B, dan Delete di dalamnya juga tidak menghapus blok.
  const body = canvas.locator("[data-puck-component] .ProseMirror").last()
  await body.click()
  await page.keyboard.press("End")
  await page.keyboard.press("ControlOrMeta+B")
  await page.keyboard.type(" Penting")
  await page.keyboard.press("Delete")
  await expect(blocks).toHaveCount(2)
  await expect(body.locator("strong")).toContainText("Penting")

  // Riwayat Puck mencatat ketikan dengan jeda dan bisa menggabungkan beberapa ketikan menjadi satu
  // langkah; berapa langkahnya bergantung pada kecepatan mesin. Satu kali urungkan sesudah jeda itu
  // selalu membatalkan ketikan terakhir, dan tidak pernah membuang bloknya.
  await page.waitForTimeout(800)
  await page.getByRole("button", { name: "Urungkan", exact: true }).click()
  await expect(blocks).toHaveCount(2)
  await expect(body.locator("strong")).toHaveCount(0)
})

test("tidak ada teks [object Object] di kanvas saat isian dijadikan teks ketik-langsung", async ({ page }) => {
  const { canvas } = await openWith(page, [
    { type: "Hero", props: { title: "Selamat datang", subtitle: "Kalimat pembuka." } },
    { type: "Features", props: {} },
    { type: "Services", props: {} },
    { type: "Steps", props: {} },
    { type: "Testimonials", props: { items: [{ quote: "Ramah.", name: "Dewi", role: "Pelanggan", rating: 5, image: null }] } },
    { type: "Faq", props: {} },
    { type: "Pricing", props: {} },
    { type: "CallToAction", props: {} },
    { type: "Text", props: {} },
  ])
  const body = canvas.locator("body")
  await expect(body).not.toContainText("[object Object]")
  const attributes = await canvas.locator("[alt], [aria-label], [title]").evaluateAll((nodes) =>
    nodes.flatMap((node) => ["alt", "aria-label", "title"].map((name) => node.getAttribute(name) ?? ""))
  )
  expect(attributes.filter((value) => value.includes("[object Object]"))).toEqual([])
})
