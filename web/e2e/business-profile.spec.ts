import { expect, test, type Page } from "@playwright/test"

async function signIn(page: Page, role: "administrator" | "staff" | "viewer", next: string) {
  await page.goto(`/auth/login?as=${role}&next=${encodeURIComponent(next)}`)
}

// PNG 1×1 piksel: cukup untuk dikenali server sebagai gambar.
const tinyPNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
)

test("administrator mengisi profil bisnis: wilayah dipilih, kode pos terisi sendiri", async ({ page }) => {
  const name = `Toko Uji ${Date.now()}`
  await signIn(page, "administrator", "/settings/business/")
  await expect(page.getByRole("heading", { name: "Profil bisnis", exact: true })).toBeVisible()

  await page.getByLabel("Nama bisnis").fill(name)
  await page.getByLabel("NPWP").fill("01.234.567.8-901.000")
  await page.getByLabel("Alamat").fill("Jl. Pasteur No. 10")

  // Wilayah dicari ke server, lalu dipilih dari hasilnya.
  await page.getByLabel("Wilayah").fill("pasteur")
  await page.getByRole("option", { name: "Desa Pasteur, Kecamatan Sukajadi, Kota Bandung, Jawa Barat" }).click()
  await expect(page.getByLabel("Kode pos")).toHaveValue("40161")

  await page.getByRole("button", { name: "Simpan" }).click()
  await expect(page.getByRole("heading", { name: "Profil bisnis disimpan" })).toBeVisible()

  // Sesudah dimuat ulang, isian menampilkan yang disimpan server.
  await page.reload()
  await expect(page.getByLabel("Nama bisnis")).toHaveValue(name)
  await expect(page.getByLabel("NPWP")).toHaveValue("0012345678901000")
  await expect(page.getByLabel("Wilayah")).toHaveValue("Desa Pasteur, Kecamatan Sukajadi, Kota Bandung, Jawa Barat")
})

test("administrator mengunggah logo, dan logonya terbuka tanpa sesi", async ({ page, browser }) => {
  await signIn(page, "administrator", "/settings/business/")
  await expect(page.getByRole("heading", { name: "Profil bisnis", exact: true })).toBeVisible()

  await page.getByLabel("Berkas logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: tinyPNG })
  await expect(page.getByRole("heading", { name: "Logo diganti" })).toBeVisible()

  const src = await page.getByRole("img", { name: "Logo bisnis" }).getAttribute("src")
  expect(src).toMatch(/^\/media\/[0-9a-f-]{36}$/)

  // Konteks baru tanpa cookie: logo adalah berkas publik.
  const anonymous = await browser.newContext()
  const response = await anonymous.request.get(src!)
  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toBe("image/png")
  await anonymous.close()
})

test("staf hanya melihat profil: formulirnya tidak ada, dan server menolak", async ({ page }) => {
  await signIn(page, "staff", "/settings/business/")
  await expect(page.getByRole("heading", { name: "Profil bisnis", exact: true })).toBeVisible()
  await expect(page.getByText("Role Anda hanya bisa melihatnya.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Simpan" })).toHaveCount(0)

  // Menyembunyikan formulir bukan penjagaan; yang menjaga server.
  const status = await page.evaluate(async () => {
    const res = await fetch("/v1/business-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: "Tidak boleh" }),
    })
    return res.status
  })
  expect(status).toBe(403)
})
