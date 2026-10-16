import { expect, test, type Page } from "@playwright/test"

// Media di editor halaman (PROTOTIPE): setiap isian gambar punya tiga sumber
// — unggah, pustaka media (Pixabay lewat server), dan alamat URL — dan isian
// video punya dua: pustaka video Pixabay dan tautan YouTube. Keduanya bisa
// dipilih langsung dari kanvas, tanpa lewat panel isian.

/** PNG 1×1 piksel. */
const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64")
const thumbnail = `data:image/png;base64,${pixel.toString("base64")}`

/**
 * Jawaban server ditiru, supaya tes ini tidak menghubungi Pixabay. Tiga foto
 * per halaman, dua halaman per kategori bertopik, dan dua video di halaman pertama.
 * Mengembalikan daftar permintaan yang sampai ke server.
 */
async function mockLibrary(page: Page) {
  const asked: string[] = []
  await page.route("**/v1/stock-media?category=*", (route) => {
    const url = new URL(route.request().url())
    const category = url.searchParams.get("category") ?? ""
    const number = Number(url.searchParams.get("page") ?? "1")
    asked.push(`${category}:${number}`)
    const photos = [1, 2, 3].map((n) => ({
      id: number * 100 + n,
      tags: `${category} ${number}-${n}`,
      width: 1920,
      height: 1280,
      preview_url: thumbnail,
      thumbnail_url: thumbnail,
      page_url: `https://pixabay.com/photos/${number * 100 + n}/`,
      user: "dapur",
    }))
    const videos = [1, 2].map((n) => ({
      id: 300 + n,
      tags: `${category} bergerak ${n}`,
      width: 1280,
      height: 720,
      duration: 60 + n,
      url: `https://cdn.pixabay.com/video/${category}-${n}_medium.mp4`,
      thumbnail_url: thumbnail,
      page_url: `https://pixabay.com/videos/${300 + n}/`,
      user: "koki",
    }))
    return route.fulfill({
      json: { data: { photos, videos: number === 1 ? videos : [], page: number, has_more: number < 2 }, configured: true, source: "Pixabay" },
    })
  })
  // Berkas videonya sendiri tidak diunduh.
  await page.route("https://cdn.pixabay.com/**", (route) => route.abort())
  await page.route("**/v1/stock-media/photos/*/file", (route) => route.fulfill({ contentType: "image/png", body: pixel }))
  return asked
}

/** Editor halaman baru berisi satu blok, ditambahkan lewat chat AI (simulasi). */
async function openWith(page: Page, request: string) {
  await page.goto(`/auth/login?as=administrator&next=${encodeURIComponent("/settings/pages/")}`)
  await page.getByRole("button", { name: "Buat halaman" }).click()
  const create = page.getByRole("dialog", { name: "Buat halaman" })
  await create.getByLabel("Judul").fill(`Uji media ${Date.now()}`)
  await create.getByRole("button", { name: "Buat dan susun isinya" }).click()
  await page.waitForURL(/\/settings\/pages\/edit\//)
  await page.getByRole("navigation", { name: "Panel editor" }).getByRole("button", { name: "AI", exact: true }).click()
  const chat = page.getByRole("complementary", { name: "Asisten AI" })
  await chat.getByRole("textbox").fill(request)
  await chat.getByRole("button", { name: "Kirim" }).click()
  await expect(chat.getByText("1 bagian disusun")).toBeVisible()
  return {
    canvas: page.frameLocator("#preview-frame"),
    fields: page.getByRole("complementary", { name: "Isian blok" }),
    // Persis: toast "Halaman … dibuat" juga ber-role dialog.
    media: page.getByRole("dialog", { name: "Pilih gambar", exact: true }),
  }
}

/** Blok "Tentang kami" terpilih: isian fotonya tampil di panel, dan tempat fotonya di kanvas masih kosong. */
async function openAbout(page: Page) {
  const editor = await openWith(page, "Tambah tentang")
  await editor.canvas.locator("[data-puck-component]").first().getByRole("heading").first().click({ force: true })
  await expect(editor.fields.getByText("Blok terpilih")).toBeVisible()
  const picture = editor.canvas.locator("[data-puck-component] img")
  await expect(picture).toHaveCount(0)
  return { ...editor, picture, sources: editor.fields.getByRole("group", { name: "Sumber gambar" }) }
}

test("isian gambar di panel: alamat URL atau unggah", async ({ page }) => {
  await mockLibrary(page)
  await page.route("https://gambar.test/foto.png", (route) => route.fulfill({ contentType: "image/png", body: pixel }))
  await page.route("https://gambar.test/hilang.png", (route) => route.fulfill({ status: 404, body: "tidak ada" }))

  const { fields, media, picture, sources } = await openAbout(page)

  // 1. Alamat URL: bentuknya diperiksa, lalu dicoba dimuat sebelum boleh dipakai.
  await sources.getByRole("button", { name: "URL" }).click()
  await expect(media.getByRole("tab", { name: "Dari URL" })).toHaveAttribute("aria-selected", "true")
  const address = media.getByLabel("Alamat gambar")
  const use = media.getByRole("button", { name: "Pakai gambar ini" })
  await address.fill("http://gambar.test/foto.png")
  await expect(media.getByText("Alamat gambar harus diawali https://.")).toBeVisible()
  await address.fill("https://cdn.pixabay.com/photo/101_640.jpg")
  await expect(media.getByText(/Foto Pixabay tidak boleh ditautkan langsung/)).toBeVisible()
  await address.fill("https://gambar.test/hilang.png")
  await expect(media.getByText(/tidak bisa dibuka sebagai gambar/)).toBeVisible()
  await expect(use).toHaveAttribute("aria-disabled", "true")
  await address.fill("https://gambar.test/foto.png")
  await expect(media.getByRole("img", { name: "Pratinjau gambar dari alamat ini" })).toBeVisible()
  await expect(use).not.toHaveAttribute("aria-disabled", "true")
  await use.click()
  await expect(media).toBeHidden()
  await expect(picture).toHaveAttribute("src", "https://gambar.test/foto.png")

  // Alamat yang terpasang tampil lagi saat tab URL dibuka.
  await fields.getByRole("group", { name: "Ganti gambar" }).getByRole("button", { name: "URL" }).click()
  await expect(address).toHaveValue("https://gambar.test/foto.png")
  await media.getByRole("button", { name: "Batal" }).click()

  // Hapus: tempat gambarnya kosong lagi.
  await fields.getByRole("button", { name: "Hapus gambar" }).click()
  await expect(picture).toHaveCount(0)

  // 2. Unggah: langsung dari panel, tanpa dialog.
  await fields.getByLabel("Berkas gambar").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: pixel })
  await expect(picture).toHaveAttribute("src", /^data:image\/webp;/)
})

test("pustaka media di panel: bawaannya acak, kategori dicari, dan jawaban server diingat", async ({ page }) => {
  const asked = await mockLibrary(page)
  const { fields, media, picture, sources } = await openAbout(page)

  // Bawaannya campuran semua topik, bukan satu bidang usaha: ketiga halamannya dimuat dengan
  // urutan acak, jadi isinya berganti setiap dibuka.
  await sources.getByRole("button", { name: "Pustaka" }).click()
  await expect(media.getByRole("tab", { name: "Pustaka media" })).toHaveAttribute("aria-selected", "true")
  const category = media.getByRole("combobox", { name: "Kategori foto" })
  const more = media.getByRole("button", { name: "Muat lebih banyak" })
  await expect(category).toHaveValue("Acak (semua topik)")
  await expect(media.getByRole("button", { name: /^Foto acak/ })).toHaveCount(3)
  await more.click()
  await expect(media.getByRole("button", { name: /^Foto acak/ })).toHaveCount(6)
  await more.click()
  await expect(media.getByRole("button", { name: /^Foto acak/ })).toHaveCount(9)
  await expect(more).toBeHidden()
  expect([...asked].sort()).toEqual(["acak:1", "acak:2", "acak:3"])

  // Kategori dicari dengan mengetik, foto dipilih, lalu disalin ke halaman.
  await category.fill("kop")
  await page.getByRole("option", { name: "Kafe dan kedai kopi" }).click()
  await expect(media.getByRole("button", { name: /^Foto kafe/ })).toHaveCount(3)
  await more.click()
  await expect(media.getByRole("button", { name: /^Foto kafe/ })).toHaveCount(6)
  await expect(more).toBeHidden()
  await media.getByRole("button", { name: "Foto kafe 2-1 oleh dapur" }).click()
  // Sumbernya disebut di samping hasil pencarian, seperti diminta Pixabay.
  await expect(media.getByRole("link", { name: "Pixabay" }).last()).toHaveAttribute("href", "https://pixabay.com/photos/201/")
  await media.getByRole("button", { name: "Pakai foto ini" }).click()
  await expect(media).toBeHidden()
  // Fotonya disalin (data URL), bukan ditautkan ke Pixabay.
  await expect(picture).toHaveAttribute("src", /^data:image\/webp;/)

  // Pustaka dibuka lagi di kategori terakhir, dan kategori yang sudah dibuka tidak ditanyakan lagi ke server.
  await fields.getByRole("group", { name: "Ganti gambar" }).getByRole("button", { name: "Pustaka" }).click()
  await expect(media.getByRole("button", { name: /^Foto kafe/ })).toHaveCount(3)
  await category.fill("jasa")
  await page.getByRole("option", { name: "Jasa profesional" }).click()
  await expect(media.getByRole("button", { name: /^Foto jasa/ })).toHaveCount(3)
  await category.fill("kop")
  await page.getByRole("option", { name: "Kafe dan kedai kopi" }).click()
  await expect(media.getByRole("button", { name: /^Foto kafe/ })).toHaveCount(3)
  expect(asked.slice(3)).toEqual(["kafe:1", "kafe:2", "jasa:1"])
})

test("gambar blok dipilih langsung dari kanvas, tanpa lewat panel isian", async ({ page }) => {
  await mockLibrary(page)
  const { canvas, media } = await openWith(page, "Tambah galeri")
  const gallery = canvas.locator("[data-puck-component]").first()
  const empty = gallery.getByRole("button", { name: "Pilih gambar" })
  const filled = gallery.getByRole("button", { name: "Ganti gambar" })
  const tiles = await empty.count()
  expect(tiles).toBeGreaterThan(2)

  // Klik tempat foto kedua: dialog media terbuka, dan foto terpilih masuk ke butir itu saja.
  await empty.nth(1).click()
  await expect(media.getByRole("tab", { name: "Pustaka media" })).toHaveAttribute("aria-selected", "true")
  await media.getByRole("button", { name: /^Foto acak/ }).nth(1).dblclick()
  await expect(media).toBeHidden()
  await expect(filled).toHaveCount(1)
  await expect(empty).toHaveCount(tiles - 1)
  const second = gallery.locator("li").nth(1)
  await expect(second.locator("img")).toHaveAttribute("src", /^data:image\/webp;/)

  // Foto yang sudah terpasang diganti dari kanvas juga, kali ini dengan alamat URL.
  await page.route("https://gambar.test/baru.png", (route) => route.fulfill({ contentType: "image/png", body: pixel }))
  await filled.click()
  await media.getByRole("tab", { name: "Dari URL" }).click()
  await media.getByLabel("Alamat gambar").fill("https://gambar.test/baru.png")
  await media.getByRole("button", { name: "Pakai gambar ini" }).click()
  // Ditunggu sampai tertutup: selama dialog memudar, latarnya masih menutupi kanvas.
  await expect(media).toBeHidden()
  await expect(second.locator("img")).toHaveAttribute("src", "https://gambar.test/baru.png")

  // Dialog mengingat tab terakhir, dan unggahan dari dialog masuk ke gambar yang diklik.
  await empty.first().click()
  await expect(media.getByRole("tab", { name: "Dari URL" })).toHaveAttribute("aria-selected", "true")
  await media.getByRole("tab", { name: "Unggah" }).click()
  await media.getByLabel("Berkas gambar").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: pixel })
  await expect(media).toBeHidden()
  await expect(filled).toHaveCount(2)

  // Setiap penggantian masuk riwayat: bisa diurungkan.
  await page.getByRole("button", { name: "Urungkan", exact: true }).click()
  await expect(filled).toHaveCount(1)

  // Di mode coba kanvas berlaku seperti halaman terbit: gambar tidak membuka apa pun.
  await page.getByRole("button", { name: /Mode coba/ }).click()
  await expect(gallery.getByRole("button", { name: /(Pilih|Ganti) gambar/ })).toHaveCount(0)
})

test("video dipilih dari pustaka Pixabay atau tautan YouTube, dari kanvas maupun panel", async ({ page }) => {
  await mockLibrary(page)
  await page.route("https://i.ytimg.com/**", (route) => route.fulfill({ contentType: "image/png", body: pixel }))
  const { canvas, fields } = await openWith(page, "Tambah pembuka")
  const hero = canvas.locator("[data-puck-component]").first()
  const media = page.getByRole("dialog", { name: "Pilih video", exact: true })

  // Susunan "Dengan video": tempat videonya bisa diklik di kanvas.
  await hero.getByRole("heading").first().click({ force: true })
  await fields.getByRole("button", { name: "Dengan video" }).click()
  await hero.getByRole("button", { name: "Pilih video", exact: true }).click()

  // 1. Pustaka video: videonya diputar langsung dari Pixabay, jadi alamatnya yang disimpan.
  await expect(media.getByRole("tab", { name: "Pustaka video" })).toHaveAttribute("aria-selected", "true")
  await expect(media.getByRole("tab")).toHaveCount(2)
  await expect(media.getByRole("button", { name: /^Video acak/ })).toHaveCount(2)
  await media.getByRole("button", { name: "Video acak bergerak 2 oleh koki, 1:02" }).click()
  await expect(media.getByRole("link", { name: "Pixabay" }).last()).toHaveAttribute("href", "https://pixabay.com/videos/302/")
  await media.getByRole("button", { name: "Pakai video ini" }).click()
  await expect(media).toBeHidden()
  await expect(hero.locator("video")).toHaveAttribute("src", /^https:\/\/cdn\.pixabay\.com\/video\/acak-2_medium\.mp4/)
  await expect(fields.getByText("Pixabay", { exact: true })).toBeVisible()

  // 2. Tautan YouTube, dari tombol "Ganti video" di kanvas.
  await hero.getByRole("button", { name: "Ganti video", exact: true }).click()
  await media.getByRole("tab", { name: "YouTube" }).click()
  const link = media.getByLabel("Tautan YouTube")
  const use = media.getByRole("button", { name: "Pakai video ini" })
  // Video pustaka bukan tautan YouTube: kolomnya kosong.
  await expect(link).toHaveValue("")
  await link.fill("https://contoh.com/video.mp4")
  await expect(media.getByText(/Ini bukan tautan video YouTube/)).toBeVisible()
  await expect(use).toHaveAttribute("aria-disabled", "true")
  await link.fill("https://youtu.be/dQw4w9WgXcQ")
  await expect(media.getByRole("img", { name: "Sampul video dari tautan ini" })).toBeVisible()
  await use.click()
  await expect(media).toBeHidden()
  await expect(hero.locator("video")).toHaveCount(0)
  await expect(hero.locator('img[src="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"]')).toHaveCount(1)
  await expect(fields.getByText("YouTube", { exact: true }).first()).toBeVisible()

  // 3. Dari panel isian: tautan yang terpasang tampil lagi, dan videonya bisa dihapus.
  await fields.getByRole("group", { name: "Ganti video" }).getByRole("button", { name: "YouTube" }).click()
  await expect(link).toHaveValue("https://youtu.be/dQw4w9WgXcQ")
  await media.getByRole("button", { name: "Batal" }).click()
  await fields.getByRole("button", { name: "Hapus video" }).click()
  await expect(hero.getByRole("button", { name: "Pilih video", exact: true })).toBeVisible()
  await expect(fields.getByRole("group", { name: "Sumber video" })).toBeVisible()
})
