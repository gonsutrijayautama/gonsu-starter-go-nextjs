import { expect, test, type Locator, type Page } from "@playwright/test"

// "Desain khusus" di editor halaman (PROTOTIPE): kuesioner menyusun prompt,
// lalu HTML jawaban AI diimpor sebagai blok "Bagian khusus". Yang diuji
// terutama penyaringnya: HTML dari luar tidak boleh menjalankan apa pun,
// memuat apa pun dari internet, atau keluar dari bagiannya sendiri.

/** Jawaban "AI" yang sengaja membawa semua yang harus dibuang. */
const hostile = `Tentu, ini halamannya:

\`\`\`html
<style>
@import url("https://jahat.example/gaya.css");
body { background: #111111; color: #eeeeee; }
.hero { padding: 40px; background-image: url(https://jahat.example/lacak.png); }
.hero h2 { color: rgb(255, 0, 0); }
.tutup { position: fixed; inset: 0; z-index: 99999; }
</style>
<header><nav><a href="/">Navbar dari AI</a></nav></header>
<section data-name="Hero" class="hero">
  <h2 onclick="window.__pwned = 1">Judul uji</h2>
  <script>window.__pwned = 1</script>
  <img src="https://jahat.example/a.png" alt="Foto produk" onerror="window.__pwned = 1">
  <a id="jahat" href="javascript:window.__pwned=1">Tautan jahat</a>
  <a id="aman" href="#menu">Lihat menu</a>
  <iframe src="https://jahat.example"></iframe>
  <form action="https://jahat.example"><input name="x"></form>
  <svg viewBox="0 0 24 24" width="24" height="24"><path d="M2 12h20" stroke="currentColor"></path><script>window.__pwned = 1</script></svg>
  <div class="tutup">Menutupi layar</div>
</section>
<section data-name="Menu" id="menu" class="menu">
  <h2>Menu uji</h2>
  <div class="photo" data-photo="Foto menu"></div>
</section>
\`\`\`
`

/** PNG 1×1 piksel. */
const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64")

/** Editor halaman baru, dengan panel AI terbuka di cara Manual. */
async function openManual(page: Page) {
  await page.goto(`/auth/login?as=administrator&next=${encodeURIComponent("/settings/pages/")}`)
  await page.getByRole("button", { name: "Buat halaman" }).click()
  const create = page.getByRole("dialog", { name: "Buat halaman" })
  await create.getByLabel("Judul").fill(`Uji desain khusus ${Date.now()}`)
  await create.getByRole("button", { name: "Buat dan susun isinya" }).click()
  await page.waitForURL(/\/settings\/pages\/edit\//)
  await page.getByRole("navigation", { name: "Panel editor" }).getByRole("button", { name: "AI", exact: true }).click()
  const panel = page.getByRole("complementary", { name: "Asisten AI" })
  await panel.getByRole("tab", { name: "Manual" }).click()
  // Persis: toast "Halaman … dibuat" juga ber-role dialog dan namanya memuat judul halaman uji.
  return { panel, dialog: page.getByRole("dialog", { name: "Desain khusus", exact: true }) }
}

/** Kuesioner dijawab seperlunya sampai prompt-nya tampil. */
async function answerBriefly(dialog: Locator) {
  const next = dialog.getByRole("button", { name: "Lanjut" })
  const skip = dialog.getByRole("button", { name: "Lewati" })
  await dialog.getByRole("radio", { name: "Kuliner dan rumah makan" }).check()
  for (const button of [next, next, next, next, skip, skip, next]) await button.click()
  await dialog.getByRole("textbox", { name: "Produk atau layanan" }).fill("Bakso urat")
  await next.click()
  await skip.click()
  await expect(dialog.locator("#custom-prompt")).toBeVisible()
}

test("kuesioner menyusun prompt dari jawabannya", async ({ page }) => {
  // Server tanpa kunci Pixabay menjawab seperti ini (TestStockMediaWithoutKey). Ditiru di sini supaya
  // tes ini tidak bergantung pada ada-tidaknya kunci di mesin yang menjalankannya.
  await page.route("**/v1/stock-media?category=*", (route) =>
    route.fulfill({ json: { data: { photos: [], videos: [] }, configured: false, source: "Pixabay" } })
  )
  const { panel, dialog } = await openManual(page)
  await panel.getByRole("button", { name: /Buat prompt baru/ }).click()
  await expect(dialog.getByText("Pertanyaan 1 dari 9")).toBeVisible()
  const next = dialog.getByRole("button", { name: "Lanjut" })
  const skip = dialog.getByRole("button", { name: "Lewati" })

  // Bidang usaha wajib dipilih: tidak ada bawaannya, dan tidak bisa dilewati.
  await expect(skip).toBeHidden()
  await next.click()
  await expect(dialog.getByText("Pilih satu bidang usaha untuk lanjut.")).toBeVisible()
  await dialog.getByRole("radio", { name: "Kecantikan dan salon" }).check()
  await next.click()
  await dialog.getByRole("radio", { name: "Daftar harga" }).check()
  await next.click()
  await dialog.getByRole("radio", { name: /Elegan & mewah/ }).check()
  await next.click()
  await dialog.getByRole("radio", { name: /Gelap dan dramatis/ }).check()
  await next.click()
  // Pertanyaan opsional yang kosong tidak bisa dilanjutkan, hanya dilewati.
  await next.click()
  await expect(dialog.getByText("Isi warnanya, atau tekan Lewati.")).toBeVisible()
  await dialog.getByRole("textbox", { name: "Warna merek" }).fill("#be185d")
  await next.click()
  await dialog.getByRole("checkbox", { name: "Galeri foto" }).check()
  await dialog.getByRole("checkbox", { name: "Tanya jawab" }).check()
  await next.click()
  await dialog.getByRole("radio", { name: "Mewah dan elegan" }).check()
  await next.click()
  await dialog.getByRole("textbox", { name: "Produk atau layanan" }).fill("Potong rambut Rp45.000, creambath Rp80.000")
  await next.click()
  await skip.click()

  const prompt = dialog.locator("#custom-prompt")
  await expect(prompt).toContainText("halaman.html")
  await expect(prompt).toContainText("Bidang: Kecantikan dan salon")
  await expect(prompt).toContainText("Jenis halaman: Daftar harga")
  await expect(prompt).toContainText("Gaya desain: Elegan & mewah")
  await expect(prompt).toContainText("Gelap dan dramatis")
  await expect(prompt).toContainText("Warna merek: #be185d")
  await expect(prompt).toContainText("Bagian yang wajib ada: Galeri foto, Tanya jawab")
  await expect(prompt).toContainText("Gaya bahasa: Mewah dan elegan")
  await expect(prompt).toContainText("Potong rambut Rp45.000, creambath Rp80.000")
  // Tanpa kunci Pixabay prompt tetap jadi, dengan tempat foto kosong.
  await expect(dialog.getByText(/Pixabay belum diaktifkan di server ini/)).toBeVisible()
  await expect(prompt).not.toContainText("pixabay:")
})

test("HTML yang sudah ada diimpor langsung, disaring, dan dikurung di bagiannya", async ({ page }) => {
  const { panel, dialog } = await openManual(page)
  await panel.getByRole("button", { name: /Impor yang sudah ada/ }).click()
  // Tanpa kuesioner: langsung ke langkah tempel.
  await expect(dialog.locator("#custom-answer")).toBeVisible()
  await dialog.locator("#custom-answer").fill(hostile)
  // Klik di luar dialog tidak menutupnya, jadi yang sudah ditempel tidak hilang.
  await page.mouse.click(8, 400)
  await expect(dialog.locator("#custom-answer")).toHaveValue(hostile)
  await dialog.getByRole("button", { name: "Periksa hasil" }).click()

  await expect(dialog.getByText("2 bagian siap dimasukkan")).toBeVisible()
  await expect(dialog.getByText("1 gambar dari AI diganti tempat foto.", { exact: false })).toBeVisible()
  await expect(dialog.getByText("Navbar dan kaki situs dari AI dilewati", { exact: false })).toBeVisible()
  await expect(dialog.getByText(/elemen atau atribut yang tidak diizinkan/)).toBeVisible()
  await dialog.getByRole("button", { name: "Masukkan ke halaman" }).click()
  await expect(dialog).toBeHidden()

  const canvas = page.frameLocator("#preview-frame")
  const sections = canvas.locator("[data-custom-section]")
  await expect(sections).toHaveCount(2)
  await expect(canvas.getByRole("heading", { name: "Judul uji" })).toBeVisible()
  await expect(canvas.getByText("Navbar dari AI")).toHaveCount(0)

  // Tidak ada yang berjalan, dan tidak ada yang tersisa untuk dijalankan.
  await canvas.getByRole("heading", { name: "Judul uji" }).click({ force: true })
  const found = await sections.first().evaluate((host) => {
    const root = host.shadowRoot!
    const hero = root.querySelector(".hero")!
    const cover = root.querySelector(".tutup")!.getBoundingClientRect()
    const box = host.getBoundingClientRect()
    return {
      pwned: (window as unknown as { __pwned?: number }).__pwned ?? null,
      forbidden: root.querySelectorAll("script, iframe, form, input, img, [onclick], [onerror]").length,
      hostileHref: root.querySelector("#jahat")?.getAttribute("href") ?? null,
      safeHref: root.querySelector("#aman")?.getAttribute("href") ?? null,
      iconPath: root.querySelector("svg path")?.getAttribute("d") ?? null,
      photoLabel: root.querySelector("[data-photo]")?.getAttribute("data-photo") ?? null,
      css: root.querySelector("style")?.textContent ?? "",
      background: getComputedStyle(hero).backgroundImage,
      headingColor: getComputedStyle(root.querySelector("h2")!).color,
      bodyBackground: getComputedStyle(root.querySelector(".custom-body")!).backgroundColor,
      coverInside: cover.top >= box.top - 1 && cover.bottom <= box.bottom + 1 && cover.left >= box.left - 1 && cover.right <= box.right + 1,
    }
  })
  expect(found.pwned).toBeNull()
  expect(found.forbidden).toBe(0)
  expect(found.hostileHref).toBeNull()
  expect(found.safeHref).toBe("#menu")
  expect(found.iconPath).toBe("M2 12h20")
  expect(found.photoLabel).toBe("Foto produk")
  expect(found.css).not.toContain("jahat.example")
  expect(found.css).not.toContain("@import")
  expect(found.background).toBe("none")
  // CSS-nya tetap berlaku: warna judul, dan gaya "body" dialihkan ke pembungkus bagian ini.
  expect(found.headingColor).toBe("rgb(255, 0, 0)")
  expect(found.bodyBackground).toBe("rgb(17, 17, 17)")
  // Elemen "position: fixed" tidak bisa menutupi halaman di luar bagiannya.
  expect(found.coverInside).toBe(true)
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned ?? null)).toBeNull()

  // Tempat foto diisi dari panel kanan, yang muncul sendiri begitu bloknya dipilih di kanvas.
  await canvas.getByRole("heading", { name: "Menu uji" }).click({ force: true })
  const fields = page.getByRole("complementary", { name: "Isian blok" })
  await expect(fields.getByText("Bagian khusus")).toBeVisible()
  await fields.getByRole("button", { name: /^Foto menu/ }).click()
  await fields.getByLabel("Berkas gambar").setInputFiles({ name: "menu.png", mimeType: "image/png", buffer: pixel })
  await expect(sections.nth(1).locator(".photo.has-photo img")).toHaveCount(1)

  // Kodenya disunting di dialog besar; yang berubah langsung tampil di kanvas.
  await fields.getByRole("button", { name: "Sunting Kode HTML" }).click()
  const editor = page.getByRole("dialog", { name: "Sunting Kode HTML" })
  const code = editor.getByRole("textbox", { name: "Kode HTML" })
  await code.fill((await code.inputValue()).replace("Menu uji", "Menu baru"))
  await editor.getByRole("button", { name: "Terapkan" }).click()
  await expect(canvas.getByRole("heading", { name: "Menu baru" })).toBeVisible()

  // Tautan di dalam bagian khusus tidak membawa editor ke mana pun.
  const url = page.url()
  await page.getByRole("button", { name: /Mode coba/ }).click()
  // Kejadiannya dikirim langsung ke tautannya: elemen "tutup" di atas menutupi bagiannya sendiri.
  await canvas.getByRole("link", { name: "Lihat menu" }).dispatchEvent("click")
  await canvas.getByText("Tautan jahat").dispatchEvent("click")
  expect(page.url()).toBe(url)
  expect(await canvas.locator("body").evaluate(() => (window as unknown as { __pwned?: number }).__pwned ?? null)).toBeNull()
})

test("foto dan video Pixabay ditawarkan di prompt dan terpasang saat diimpor", async ({ page }) => {
  // Jawaban server ditiru, supaya tes ini tidak menghubungi Pixabay.
  await page.route("**/v1/stock-media?category=*", (route) =>
    route.fulfill({
      json: {
        data: {
          photos: [{ id: 101, tags: "bakso, kuah, makanan", width: 1920, height: 1280, preview_url: "https://cdn.pixabay.com/photo/101_150.jpg", page_url: "https://pixabay.com/photos/101/", user: "dapur" }],
          videos: [{ id: 202, tags: "dapur, memasak", width: 1280, height: 720, duration: 12, url: "https://cdn.pixabay.com/video/202_medium.mp4", thumbnail_url: "", page_url: "https://pixabay.com/videos/202/", user: "koki" }],
        },
        configured: true,
        source: "Pixabay",
      },
    })
  )
  await page.route("**/v1/stock-media/photos/101/file", (route) => route.fulfill({ contentType: "image/png", body: pixel }))
  await page.route("**/v1/stock-media/videos/202", (route) =>
    route.fulfill({ json: { data: { id: 202, tags: "dapur, memasak", width: 1280, height: 720, duration: 12, url: "https://cdn.pixabay.com/video/202_medium.mp4", thumbnail_url: "", page_url: "", user: "koki" } } })
  )
  await page.route("https://cdn.pixabay.com/**", (route) => route.abort())

  const { panel, dialog } = await openManual(page)
  await panel.getByRole("button", { name: /Buat prompt baru/ }).click()
  await answerBriefly(dialog)

  const prompt = dialog.locator("#custom-prompt")
  await expect(prompt).toContainText("pixabay:101: mendatar, bakso, kuah, makanan")
  await expect(prompt).toContainText("pixabay:202: 12 detik, dapur, memasak")
  // Sumbernya disebut di samping hasil pencarian, seperti diminta Pixabay.
  await expect(dialog.getByRole("link", { name: "Pixabay", exact: true })).toBeVisible()
  await expect(dialog.getByRole("link", { name: /Foto bakso, kuah, makanan oleh dapur di Pixabay/ })).toBeVisible()

  await dialog.getByRole("button", { name: "Saya sudah punya jawabannya" }).click()
  await dialog.locator("#custom-answer").fill(`<style>.pembuka { padding: 24px; }</style>
<section data-name="Pembuka" class="pembuka">
  <h2>Halo dari Pixabay</h2>
  <div class="video" data-video="pixabay:202"></div>
  <div class="photo" data-photo="pixabay:101"></div>
  <div class="photo" data-photo="Foto pemilik usaha"></div>
</section>`)
  await dialog.getByRole("button", { name: "Periksa hasil" }).click()
  await expect(dialog.getByText("1 bagian siap dimasukkan")).toBeVisible()
  await expect(dialog.getByText("1 dari 2 foto terisi, 1 video")).toBeVisible()
  await dialog.getByRole("button", { name: "Masukkan ke halaman" }).click()
  await expect(dialog).toBeHidden()

  const section = page.frameLocator("#preview-frame").locator("[data-custom-section]")
  await expect(section).toHaveCount(1)
  // Fotonya disalin ke halaman (data URL), bukan ditautkan ke Pixabay; videonya diputar langsung dari Pixabay.
  const media = await section.evaluate((host) => {
    const root = host.shadowRoot!
    const photos = Array.from(root.querySelectorAll(".photo"))
    return {
      first: photos[0]?.querySelector("img")?.getAttribute("src")?.slice(0, 16) ?? null,
      second: photos[1]?.querySelector("img") ? "terisi" : "kosong",
      video: root.querySelector("video")?.getAttribute("src") ?? null,
      muted: root.querySelector("video")?.muted ?? null,
    }
  })
  expect(media.first).toBe("data:image/webp;")
  expect(media.second).toBe("kosong")
  expect(media.video).toBe("https://cdn.pixabay.com/video/202_medium.mp4")
  expect(media.muted).toBe(true)
})
