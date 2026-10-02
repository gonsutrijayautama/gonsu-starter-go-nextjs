import { expect, test, type Page } from "@playwright/test"

// Server e2e adalah build dev: /auth/login?as=<role> membuat pengguna role itu
// bila belum ada, menerbitkan sesi, lalu menuju `next`. Build rilis tidak
// membawanya (dibuktikan `make smoke`).
async function signIn(page: Page, role: "administrator" | "staff" | "viewer", next: string) {
  await page.goto(`/auth/login?as=${role}&next=${encodeURIComponent(next)}`)
}

test("administrator menulis catatan, lalu catatannya tampil di daftar", async ({ page }) => {
  const title = `Catatan uji ${Date.now()}`
  await signIn(page, "administrator", "/notes/")
  await expect(page.getByRole("heading", { name: "Catatan", exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Catatan baru" }).click()
  // Dengan nama: toast Base UI juga ber-role dialog.
  const dialog = page.getByRole("dialog", { name: "Catatan baru" })
  await dialog.getByLabel("Judul").fill(title)
  await dialog.getByLabel("Isi").fill("Ditulis oleh uji ujung ke ujung.")
  await dialog.getByRole("button", { name: "Simpan" }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByRole("heading", { name: "Catatan dibuat" })).toBeVisible()
  await expect(page.getByText(title)).toBeVisible()
})

test("viewer hanya membaca: tombol menulis tidak ada, dan server menolak", async ({ page }) => {
  await signIn(page, "viewer", "/notes/")
  await expect(page.getByRole("heading", { name: "Catatan", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Catatan baru" })).toHaveCount(0)

  // Menyembunyikan tombol bukan penjagaan; yang menjaga server. Dikirim dari
  // dalam halaman supaya membawa sesi dan origin yang sama dengan aplikasinya.
  const status = await page.evaluate(async () => {
    const res = await fetch("/v1/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ title: "Tidak boleh", body: "" }),
    })
    return res.status
  })
  expect(status).toBe(403)
})
