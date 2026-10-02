import { defineConfig, devices } from "@playwright/test"

// Uji ujung ke ujung di peramban. Server-nya BUKAN urusan berkas ini:
// `make e2e` di akar project menjalankan server build dev di atas database
// sendiri, lalu memanggil `make -C web e2e` dengan E2E_BASE_URL menunjuk
// server itu. Frontend hanya perlu tahu alamatnya.
const baseURL = process.env.E2E_BASE_URL

export default defineConfig({
  testDir: "e2e",
  // Satu server dan satu database untuk semua tes: berurutan, tanpa saling
  // menunggu data milik tes lain.
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
