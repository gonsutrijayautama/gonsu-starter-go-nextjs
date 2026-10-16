import { expect, test, type Page } from "@playwright/test"

// Chat AI di editor halaman dengan AI sungguhan (PROTOTIPE). Server uji tidak
// punya kunci model AI, jadi jawaban /v1/page-ai ditirukan di sini: yang diuji
// adalah layarnya — permintaan yang dikirim ke server, dan perintah dari
// server yang diterapkan ke kanvas. Penyusun simulasi diuji di pages-ai.spec.ts.

type PageAiEvent = Record<string, unknown>

type Asked = {
  prompt: string
  history: { role: string; text: string }[]
  sections: { ref: string; type: string; props: Record<string, unknown> | null }[]
  guide: string
}

/** Editor dengan asisten AI aktif. `replies`: jawaban server, satu per permintaan, berurutan. */
async function openEditor(page: Page, replies: (PageAiEvent[] | { status: number; body: unknown })[]) {
  const asked: Asked[] = []
  await page.route(
    (url) => url.pathname === "/v1/page-ai",
    (route) => route.fulfill({ json: { data: { configured: true, model: "uji/model" } } })
  )
  await page.route(
    (url) => url.pathname === "/v1/page-ai/replies",
    async (route) => {
      asked.push(route.request().postDataJSON() as Asked)
      const reply = replies[asked.length - 1] ?? []
      if (!Array.isArray(reply)) return route.fulfill({ status: reply.status, json: reply.body })
      await route.fulfill({ contentType: "application/x-ndjson", body: reply.map((event) => JSON.stringify(event) + "\n").join("") })
    }
  )

  await page.goto(`/auth/login?as=administrator&next=${encodeURIComponent("/settings/pages/")}`)
  await page.getByRole("button", { name: "Buat halaman" }).click()
  const dialog = page.getByRole("dialog", { name: "Buat halaman" })
  await dialog.getByLabel("Judul").fill(`Uji AI sungguhan ${Date.now()}`)
  await dialog.getByRole("button", { name: "Buat dan susun isinya" }).click()
  await page.waitForURL(/\/settings\/pages\/edit\//)
  await page.getByRole("button", { name: "AI", exact: true }).click()
  const panel = page.getByRole("complementary", { name: "Asisten AI" })
  await expect(panel.getByRole("heading", { name: "Asisten halaman" })).toBeVisible()
  const frame = page.frameLocator("#preview-frame")
  const blocks = frame.locator("[data-puck-component]")
  /** Jenis blok di kanvas, dari atas ke bawah. */
  const order = () => blocks.evaluateAll((nodes) => nodes.map((node) => (node.getAttribute("data-puck-component") ?? "").split("-")[0]))
  const send = async (text: string) => {
    // Pesan baru hanya diterima sesudah jawaban sebelumnya selesai: tombol kirim kembali tampil.
    await expect(panel.getByRole("button", { name: "Kirim" })).toBeVisible()
    await panel.getByLabel("Pesan untuk asisten halaman").fill(text)
    await panel.getByLabel("Pesan untuk asisten halaman").press("Enter")
  }
  return { panel, frame, blocks, order, send, asked }
}

const hero = { type: "Hero", props: { variant: "split", title: "Roti hangat", highlight: "setiap pagi", subtitle: "Dipanggang sebelum subuh.", image: null } }
const faq = { type: "Faq", props: { title: "Sering ditanyakan", items: [{ question: "Bisa pesan antar?", answer: "Bisa, di dalam kota." }] } }

test("AI menyusun halaman, mengubah satu bagian, menyisipkan, lalu bisa diurungkan", async ({ page }) => {
  const { panel, frame, blocks, order, send, asked } = await openEditor(page, [
    [{ type: "insert", item: hero }, { type: "insert", item: faq }, { type: "text", text: "Beranda sudah saya susun." }, { type: "done" }],
    [
      { type: "update", ref: "s1", props: { title: "Hangat dari dapur", highlight: "" } },
      { type: "insert", before: "s2", item: { type: "Gallery", props: { title: "Dari dapur kami" } } },
      { type: "text", text: "Judulnya sudah saya ganti, dan galeri saya taruh di atas tanya jawab." },
      { type: "done" },
    ],
  ])
  // Server punya kunci model AI: tidak ada tanda simulasi.
  await expect(panel.getByText("Simulasi", { exact: true })).toHaveCount(0)

  await send("Buatkan beranda toko roti")
  await expect(panel.getByText("2 bagian disusun")).toBeVisible()
  await expect(panel.getByText("Beranda sudah saya susun.")).toBeVisible()
  await expect(blocks).toHaveCount(2)
  await expect(frame.getByRole("heading", { name: /Roti hangat/ })).toBeVisible()
  // Yang dikirim: permintaannya, halaman yang masih kosong, dan katalog blok dari konfigurasi editor.
  expect(asked[0]?.prompt).toBe("Buatkan beranda toko roti")
  expect(asked[0]?.sections).toEqual([])
  expect(asked[0]?.guide).toContain("## Katalog blok siap pakai")
  expect(asked[0]?.guide).toContain('"Hero"')

  await send("Ganti judulnya dan tambahkan galeri")
  await expect(panel.getByText("1 bagian diubah")).toBeVisible()
  await expect(panel.getByText(/galeri saya taruh di atas tanya jawab/)).toBeVisible()
  // Bagian disisipkan di atas bagian yang ditunjuk, bukan di paling bawah.
  expect(await order()).toEqual(["Hero", "Gallery", "Faq"])
  await expect(frame.getByRole("heading", { name: "Hangat dari dapur" })).toBeVisible()
  // Isian yang tidak disebut AI tetap seperti semula.
  await expect(frame.getByText("Dipanggang sebelum subuh.")).toBeVisible()
  // Permintaan kedua membawa isi halaman dengan rujukan pendek, dan percakapan sebelumnya.
  expect(asked[1]?.sections.map((section) => `${section.ref}:${section.type}`)).toEqual(["s1:Hero", "s2:Faq"])
  expect(asked[1]?.sections[0]?.props?.title).toBe("Roti hangat")
  expect(asked[1]?.history).toEqual([
    { role: "user", text: "Buatkan beranda toko roti" },
    { role: "assistant", text: "Beranda sudah saya susun." },
  ])

  await panel.getByRole("button", { name: "Urungkan perubahan ini" }).click()
  expect(await order()).toEqual(["Hero", "Faq"])
  await expect(frame.getByRole("heading", { name: /Roti hangat/ })).toBeVisible()
})

test("AI membuang bagian dan mengosongkan halaman", async ({ page }) => {
  const { panel, order, send } = await openEditor(page, [
    [{ type: "insert", item: hero }, { type: "insert", item: faq }, { type: "done" }],
    [{ type: "remove", ref: "s2" }, { type: "text", text: "Tanya jawab sudah saya buang." }, { type: "done" }],
    [{ type: "clear" }, { type: "insert", item: faq }, { type: "text", text: "Halaman saya susun ulang." }, { type: "done" }],
  ])

  await send("Buatkan beranda")
  // Jawaban tanpa kalimat penutup tetap ditutup dengan satu kalimat.
  await expect(panel.getByText("Sudah saya kerjakan. Periksa hasilnya di kanvas.")).toBeVisible()
  expect(await order()).toEqual(["Hero", "Faq"])

  await send("Buang tanya jawab")
  await expect(panel.getByText("1 bagian dibuang")).toBeVisible()
  expect(await order()).toEqual(["Hero"])

  await send("Susun ulang dari awal")
  await expect(panel.getByText("Halaman saya susun ulang.")).toBeVisible()
  expect(await order()).toEqual(["Faq"])
})

test("galat dari server tampil di percakapan, dan bagian yang sudah tersusun tetap ada", async ({ page }) => {
  const { panel, blocks, send } = await openEditor(page, [
    [{ type: "insert", item: hero }, { type: "error", code: "AI_UNAVAILABLE", message: "Jawaban AI terpotong karena terlalu panjang." }],
    { status: 503, body: { error: { code: "AI_UNAVAILABLE", message: "AI sedang sibuk. Tunggu sebentar, lalu coba lagi." } } },
    // Aliran yang berakhir tanpa "done": terputus di jalan.
    [{ type: "insert", item: faq }],
  ])

  await send("Buatkan beranda")
  await expect(panel.getByText("Jawaban AI terpotong karena terlalu panjang.")).toBeVisible()
  await expect(blocks).toHaveCount(1)

  await send("Lanjutkan")
  await expect(panel.getByText("AI sedang sibuk. Tunggu sebentar, lalu coba lagi.")).toBeVisible()
  await expect(blocks).toHaveCount(1)

  await send("Tambahkan tanya jawab")
  await expect(panel.getByText(/Jawaban AI terputus di tengah jalan/)).toBeVisible()
  await expect(blocks).toHaveCount(2)
})
