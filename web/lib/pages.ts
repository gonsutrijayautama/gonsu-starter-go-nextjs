import type { Data } from "@puckeditor/core"

import { ApiError } from "@/lib/api"

// PROTOTIPE penyusun halaman. Belum ada backend: data halaman disimpan di
// localStorage peramban ini, dengan bentuk yang sama dengan rencana kontrak
// modul appkit `pages`. Setiap fungsi di bawah adalah satu endpoint rencana
// (lihat komentarnya); begitu modulnya ada, isinya diganti panggilan `api()`
// dan layarnya tidak perlu berubah.

export type PageStatus = "draft" | "published" | "changed"

export type PageNavigation = { visible: boolean; position: number }

/** Pratinjau tautan halaman. Di prototipe `image` berupa data URL; kelak berkas media. */
export type PageSEO = { title: string; description: string; image: string | null }

/** Satu baris daftar halaman (GET /v1/pages): tanpa isi draf. */
export type PageSummary = {
  id: string
  /** "/" untuk beranda; selain itu satu tingkat, mis. "/layanan". */
  path: string
  title: string
  navigation: PageNavigation
  seo: PageSEO
  status: PageStatus
  /** Dikirim balik saat menyimpan; yang usang ditolak (409). */
  version: number
  published_at: string | null
  updated_at: string
}

/** Satu halaman lengkap (GET /v1/pages/{id}): `draft` adalah data Puck. */
export type Page = PageSummary & { draft: Data }

/** Satu versi yang pernah diterbitkan. */
export type PageVersion = {
  id: string
  number: number
  title: string
  published_at: string
  published_by: string
}

/** Isi website lama (`website.Legacy` di appkit). */
export type LegacyContent = {
  about_text: string
  services: { title: string; description: string; icon: string }[]
  about_image: string | null
}

/** Yang dibutuhkan halaman publik untuk satu alamat. */
export type PublishedPage = { path: string; title: string; seo: PageSEO; data: Data }

/** Satu tautan menu navigasi publik. */
export type NavigationLink = { path: string; title: string }

// --- Navbar dan kaki situs -------------------------------------------------------
//
// Disimpan sekali untuk seluruh situs, bukan per halaman, dengan draf dan versi
// terbit seperti halaman. Identitas bisnis (nama, logo, kontak, kanal) tidak
// disimpan di sini: tetap dibaca dari Profil bisnis dan Website.

/** Tautan: "/halaman", "#bagian", atau https. `id` hanya untuk mengurutkan di editor. */
export type SiteLink = { id: string; label: string; link: string }
export type NavItem = SiteLink & { children: SiteLink[] }
export type FooterColumn = { id: string; title: string; links: SiteLink[] }
/**
 * Latar navbar, kaki situs, dan banner. "blur": kaca buram, warnanya tembus
 * pandang sebanyak `opacity`. Warna "custom" dan gradien bisa digelapkan
 * otomatis di mode gelap (`adapt`).
 */
export type ChromeLook = {
  kind: "solid" | "blur" | "gradient"
  tone: "default" | "muted" | "primary" | "inverse" | "custom"
  /** Warna "custom", dan warna awal gradien: #rrggbb. */
  color: string
  /** Warna akhir gradien. */
  color2: string
  direction: "right" | "down" | "diagonal"
  /** Kepekatan latar kaca buram, 30–100 (persen). */
  opacity: number
  adapt: boolean
  /** Garis batas dengan isi halaman. */
  border: boolean
}

export function chromeLook(over: Partial<ChromeLook> = {}): ChromeLook {
  return { kind: "solid", tone: "default", color: "#1e2a4a", color2: "#4c1d95", direction: "right", opacity: 80, adapt: true, border: true, ...over }
}

/** Banner di atas navbar. Teks kosong = tanpa banner. */
export type Banner = {
  text: string
  link: string
  /** Teks tautan di ujung banner, mis. "Lihat promo". */
  link_label: string
  /** Nama ikon lucide; kosong = tanpa ikon. */
  icon: string
  /** Pengunjung bisa menutupnya; tetap tertutup sampai teksnya berganti. */
  dismissible: boolean
  /** Teks berjalan, bukan diam di tengah. */
  moving: boolean
  background: ChromeLook
}

export type HeaderSettings = {
  variant: "classic" | "centered" | "stacked" | "floating" | "minimal"
  /** Halaman bertanda "Tampil di menu" masuk menu, sebelum tautan sendiri. */
  auto_pages: boolean
  links: NavItem[]
  /** Tombol aksi; label kosong = tanpa tombol. */
  cta: SiteLink
  show_login: boolean
  sticky: boolean
  announcement: Banner
  background: ChromeLook
}

export type FooterSettings = {
  variant: "columns" | "simple" | "centered" | "big"
  show_tagline: boolean
  show_contact: boolean
  show_pages: boolean
  show_channels: boolean
  columns: FooterColumn[]
  /** Ajakan di atas kaki situs (varian "big"); judul kosong = tanpa ajakan. */
  cta: SiteLink & { title: string }
  /** Kosong = "© tahun nama bisnis". */
  copyright: string
  background: ChromeLook
}

export type SiteChrome = { header: HeaderSettings; footer: FooterSettings }
export type SiteChromeState = { draft: SiteChrome; published: SiteChrome; version: number }

export const defaultChrome: SiteChrome = {
  header: {
    variant: "classic",
    auto_pages: true,
    links: [],
    cta: { id: "cta", label: "", link: "" },
    show_login: true,
    sticky: true,
    announcement: { text: "", link: "", link_label: "", icon: "", dismissible: false, moving: false, background: chromeLook({ tone: "primary", border: false }) },
    background: chromeLook({ kind: "blur", opacity: 85 }),
  },
  footer: {
    variant: "columns",
    show_tagline: true,
    show_contact: true,
    show_pages: true,
    show_channels: true,
    columns: [],
    cta: { id: "cta", title: "", label: "", link: "" },
    copyright: "",
    background: chromeLook(),
  },
}

export const maxVersions = 20
export const maxTitle = 80

/**
 * Alamat yang dipakai aplikasi sendiri. Halaman tidak boleh memakainya, atau
 * ia menutupi route aplikasi. Kelak daftar ini milik produk (route-nya ada di
 * produk), diserahkan ke modul pages.
 */
export const reservedPaths = [
  "/auth", "/login", "/logout", "/v1", "/api", "/media", "/site.json", "/healthz", "/_next",
  "/dashboard", "/notes", "/settings", "/sign-in", "/situs", "/404", "/favicon.ico",
]

type StoredPage = Page & {
  /** Data Puck yang sedang terbit; null bila belum pernah atau sudah dibatalkan. */
  published: Data | null
  history: (PageVersion & { data: Data })[]
}

type StoredChrome = SiteChromeState & { updated_at: string }

type Store = {
  pages: StoredPage[]
  /** Navbar dan kaki situs: sekali per situs. Toko lama belum punya, jadi nilai bawaan. */
  chrome?: StoredChrome
  /** Paket menyertakan penyusun halaman. */
  enabled: boolean
  legacyImported: boolean
}

const storageKey = "prototipe.pages.v1"
const emptyData = (): Data => ({ root: { props: {} }, content: [], zones: {} })
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const now = () => new Date().toISOString()
const newId = () => crypto.randomUUID()
const delay = () => new Promise((resolve) => setTimeout(resolve, 180))

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)])
    )
  }
  return value
}

/**
 * Kunci pembanding isi halaman: dua data Puck yang isinya sama memberi kunci
 * yang sama, walau urutan kuncinya berbeda — Puck menyusun ulang data yang
 * dimuatnya, jadi `JSON.stringify` langsung selalu terlihat "berubah".
 */
export function contentKey(data: Data): string {
  const { zones, ...rest } = data
  return JSON.stringify(canonical(zones && Object.keys(zones).length > 0 ? data : rest))
}

function statusOf(page: StoredPage): PageStatus {
  if (!page.published) return "draft"
  return contentKey(page.published) === contentKey(page.draft) ? "published" : "changed"
}

function summaryOf(page: StoredPage): PageSummary {
  return {
    id: page.id, path: page.path, title: page.title, navigation: page.navigation, seo: page.seo,
    status: statusOf(page), version: page.version, published_at: page.published_at, updated_at: page.updated_at,
  }
}

function pageOf(page: StoredPage): Page {
  return { ...summaryOf(page), draft: clone(page.draft) }
}

function read(): Store {
  if (typeof window === "undefined") return seed()
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw) return JSON.parse(raw) as Store
  } catch {
    // Penyimpanan peramban tidak terbaca: mulai dari data contoh.
  }
  const fresh = seed()
  write(fresh)
  return fresh
}

function write(store: Store) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(store))
  } catch {
    throw new ApiError(507, "STORAGE_FULL", "Penyimpanan peramban penuh. Pakai gambar yang lebih kecil, atau kembalikan data contoh.")
  }
}

function notFound(): never {
  throw new ApiError(404, "NOT_FOUND", "Halaman tidak ditemukan.")
}

function find(store: Store, id: string): StoredPage {
  return store.pages.find((page) => page.id === id) ?? notFound()
}

function requireEnabled(store: Store) {
  if (!store.enabled) {
    throw new ApiError(403, "ENTITLEMENT_REQUIRED", "Paket Anda belum termasuk penyusun halaman. Halaman yang sudah ada tetap tampil.", [], undefined, "pages.builder")
  }
}

function requireVersion(page: StoredPage, version: number) {
  if (page.version !== version) {
    throw new ApiError(409, "CONCURRENT_MODIFICATION", "Halaman ini sudah diubah orang lain. Muat ulang untuk melihat yang terbaru.")
  }
}

/**
 * Alamat halaman publik di prototipe. Kelak halaman tampil di alamatnya
 * sendiri ("/layanan"), disajikan server Go dengan data yang disisipkan.
 */
export function publicHref(path: string) {
  return `/situs/?alamat=${encodeURIComponent(path)}`
}

/** Editor satu halaman. Static export: id lewat query string, bukan segmen. */
export function editorHref(id: string) {
  return `/settings/pages/edit/?id=${id}`
}

/** Alamat yang diusulkan dari judul: huruf kecil, angka, dan tanda hubung. */
export function suggestPath(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "")
  return `/${slug}`
}

/** Masalah bentuk alamat, atau null. Keunikan diperiksa "server". */
export function pathProblem(path: string): string | null {
  if (path === "/") return null
  if (!/^\/[a-z0-9]+(-[a-z0-9]+)*$/.test(path)) {
    return "Pakai huruf kecil, angka, dan tanda hubung, satu tingkat. Misalnya /layanan."
  }
  if (path.length > 61) return "Alamat maksimal 60 karakter sesudah garis miring."
  if (reservedPaths.some((reserved) => path === reserved || path.startsWith(`${reserved}/`))) {
    return "Alamat ini dipakai aplikasi. Pilih alamat lain."
  }
  return null
}

function validate(store: Store, input: { title: string; path: string }, selfId?: string) {
  const details: { field: string; message: string }[] = []
  const title = input.title.trim()
  if (!title) details.push({ field: "title", message: "Judul wajib diisi." })
  else if (title.length > maxTitle) details.push({ field: "title", message: `Judul maksimal ${maxTitle} karakter.` })
  const problem = pathProblem(input.path)
  if (problem) details.push({ field: "path", message: problem })
  const taken = store.pages.find((page) => page.path === input.path && page.id !== selfId)
  if (!problem && taken) {
    details.push({
      field: "path",
      message: input.path === "/" ? "Beranda sudah ada." : `Alamat ini sudah dipakai halaman “${taken.title}”.`,
    })
  }
  if (details.length > 0) throw new ApiError(400, "VALIDATION_FAILED", "Isian belum benar.", details)
}

// --- Endpoint rencana ------------------------------------------------------

/** GET /v1/pages */
export async function listPages(): Promise<{ data: PageSummary[]; enabled: boolean; legacy: LegacyContent | null }> {
  await delay()
  const store = read()
  const data = store.pages.map(summaryOf).sort((a, b) => {
    if (a.path === "/") return -1
    if (b.path === "/") return 1
    return a.navigation.position - b.navigation.position || a.title.localeCompare(b.title)
  })
  return { data, enabled: store.enabled, legacy: store.legacyImported ? null : legacySample }
}

/** GET /v1/pages/{id} */
export async function getPage(id: string): Promise<Page & { enabled: boolean }> {
  await delay()
  const store = read()
  return { ...pageOf(find(store, id)), enabled: store.enabled }
}

/** POST /v1/pages (Idempotency-Key) */
export async function createPage(input: { title: string; path: string }): Promise<Page> {
  await delay()
  const store = read()
  requireEnabled(store)
  validate(store, input)
  const position = Math.max(0, ...store.pages.map((page) => page.navigation.position)) + 1
  const page: StoredPage = {
    id: newId(), path: input.path, title: input.title.trim(),
    navigation: { visible: input.path !== "/", position },
    seo: { title: "", description: "", image: null },
    status: "draft", version: 1, published_at: null, updated_at: now(),
    draft: emptyData(), published: null, history: [],
  }
  store.pages.push(page)
  write(store)
  return pageOf(page)
}

/** PUT /v1/pages/{id}: judul, alamat, navigasi, dan SEO (bukan isi). */
export async function updatePageSettings(
  id: string,
  input: { title: string; path: string; navigation: PageNavigation; seo: PageSEO; version: number }
): Promise<Page> {
  await delay()
  const store = read()
  requireEnabled(store)
  const page = find(store, id)
  requireVersion(page, input.version)
  // Beranda selalu "/": alamatnya tidak diganti dari sini.
  const path = page.path === "/" ? "/" : input.path
  validate(store, { title: input.title, path }, id)
  Object.assign(page, {
    title: input.title.trim(), path, navigation: input.navigation,
    seo: { title: input.seo.title.trim(), description: input.seo.description.trim(), image: input.seo.image },
    version: page.version + 1, updated_at: now(),
  })
  write(store)
  return pageOf(page)
}

/** PUT /v1/pages/{id}: isi draf (data Puck). */
export async function saveDraft(id: string, input: { draft: Data; version: number }): Promise<Page> {
  await delay()
  const store = read()
  requireEnabled(store)
  const page = find(store, id)
  requireVersion(page, input.version)
  page.draft = clone(input.draft)
  page.version += 1
  page.updated_at = now()
  write(store)
  return pageOf(page)
}

/** POST /v1/pages/{id}/publish: menerbitkan draf yang tersimpan. */
export async function publishPage(id: string, input: { version: number; by: string }): Promise<Page> {
  await delay()
  const store = read()
  requireEnabled(store)
  const page = find(store, id)
  requireVersion(page, input.version)
  if (page.draft.content.length === 0) {
    throw new ApiError(400, "VALIDATION_FAILED", "Halaman kosong tidak bisa diterbitkan. Tambahkan minimal satu blok.")
  }
  page.published = clone(page.draft)
  page.published_at = now()
  page.history.unshift({
    id: newId(), number: (page.history[0]?.number ?? 0) + 1, title: page.title,
    published_at: page.published_at, published_by: input.by, data: clone(page.draft),
  })
  page.history = page.history.slice(0, maxVersions)
  page.version += 1
  page.updated_at = now()
  write(store)
  return pageOf(page)
}

/** POST /v1/pages/{id}/unpublish */
export async function unpublishPage(id: string): Promise<Page> {
  await delay()
  const store = read()
  requireEnabled(store)
  const page = find(store, id)
  page.published = null
  page.published_at = null
  page.version += 1
  page.updated_at = now()
  write(store)
  return pageOf(page)
}

/** DELETE /v1/pages/{id}: tetap boleh walau paket tidak menyertakan penyusun halaman. */
export async function deletePage(id: string): Promise<void> {
  await delay()
  const store = read()
  find(store, id)
  store.pages = store.pages.filter((page) => page.id !== id)
  write(store)
}

/** GET /v1/pages/{id}/versions */
export async function listVersions(id: string): Promise<PageVersion[]> {
  await delay()
  const page = find(read(), id)
  return page.history.map((entry) => ({
    id: entry.id, number: entry.number, title: entry.title, published_at: entry.published_at, published_by: entry.published_by,
  }))
}

/** POST /v1/pages/{id}/versions/{versionId}/restore: isi versi itu menjadi draf. */
export async function restoreVersion(id: string, versionId: string): Promise<Page> {
  await delay()
  const store = read()
  requireEnabled(store)
  const page = find(store, id)
  const version = page.history.find((entry) => entry.id === versionId) ?? notFound()
  page.draft = clone(version.data)
  page.version += 1
  page.updated_at = now()
  write(store)
  return pageOf(page)
}

/**
 * Mengisi draf beranda dari isi website lama. Beranda dibuat bila belum ada;
 * bila sudah ada, blok impor ditambahkan di bawah isinya.
 */
export async function importLegacy(): Promise<Page> {
  await delay()
  const store = read()
  requireEnabled(store)
  let home = store.pages.find((page) => page.path === "/")
  if (!home) {
    home = {
      id: newId(), path: "/", title: "Beranda", navigation: { visible: false, position: 0 },
      seo: { title: "", description: "", image: null }, status: "draft", version: 1,
      published_at: null, updated_at: now(), draft: emptyData(), published: null, history: [],
    }
    store.pages.unshift(home)
  }
  home.draft.content.push(...legacyBlocks(legacySample))
  home.version += 1
  home.updated_at = now()
  store.legacyImported = true
  write(store)
  return pageOf(home)
}

// --- Halaman publik (tanpa sesi) -------------------------------------------

/** GET /pages/public?path=: versi TERBIT satu alamat, atau null (404). */
export function publishedPage(path: string): PublishedPage | null {
  const page = read().pages.find((entry) => entry.path === path)
  if (!page?.published) return null
  return { path: page.path, title: page.title, seo: page.seo, data: clone(page.published) }
}

/** Menu navigasi publik: halaman TERBIT bertanda tampil di menu, urut. */
export function publicNavigation(): NavigationLink[] {
  return read()
    .pages.filter((page) => page.published && page.navigation.visible)
    .sort((a, b) => a.navigation.position - b.navigation.position)
    .map((page) => ({ path: page.path, title: page.title }))
}

// --- Navbar dan kaki situs ---------------------------------------------------------

function chromeOf(store: Store): StoredChrome {
  return store.chrome ?? { draft: clone(defaultChrome), published: clone(defaultChrome), version: 1, updated_at: now() }
}

export const newLinkId = () => newId().slice(0, 8)

/** Tautan tanpa id (data lama) diberi id, supaya bisa diurutkan di editor. */
function withId<T extends { id?: string }>(item: T): T & { id: string } {
  return { ...item, id: item.id || newLinkId() }
}

type LegacyLook = ChromeLook | "default" | "muted" | "primary" | "inverse" | undefined

/** Latar data lama berupa satu kata ("muted"); kini objek latar lengkap. */
function lookOf(value: LegacyLook, fallback: ChromeLook): ChromeLook {
  if (!value) return fallback
  if (typeof value === "string") return { ...fallback, kind: fallback.kind === "blur" && value === "default" ? "blur" : "solid", tone: value }
  return { ...fallback, ...value }
}

type LegacyBanner = Partial<Banner> & { label?: string }

/** Pengumuman data lama berupa tautan ({label, link}); kini banner lengkap. */
function bannerOf(value: LegacyBanner | undefined): Banner {
  const base = defaultChrome.header.announcement
  if (!value) return base
  return { ...base, ...value, text: value.text ?? value.label ?? "", background: lookOf(value.background, base.background) }
}

/** Isian yang belum ada di data lama terisi nilai bawaan. */
function withDefaults(chrome: SiteChrome): SiteChrome {
  const header = { ...defaultChrome.header, ...chrome.header }
  const footer = { ...defaultChrome.footer, ...chrome.footer }
  return {
    header: {
      ...header,
      links: header.links.map((item) => ({ ...withId(item), children: (item.children ?? []).map(withId) })),
      announcement: bannerOf(chrome.header?.announcement as LegacyBanner | undefined),
      background: lookOf(chrome.header?.background as LegacyLook, defaultChrome.header.background),
    },
    footer: {
      ...footer,
      columns: footer.columns.map((column) => ({ ...withId(column), links: column.links.map(withId) })),
      background: lookOf(chrome.footer?.background as LegacyLook, defaultChrome.footer.background),
    },
  }
}

/** GET /v1/site-chrome: draf dan versi terbit navbar serta kaki situs. */
export async function getChrome(): Promise<SiteChromeState> {
  await delay()
  const chrome = chromeOf(read())
  return { draft: withDefaults(chrome.draft), published: withDefaults(chrome.published), version: chrome.version }
}

/** PUT /v1/site-chrome: simpan draf. */
export async function saveChromeDraft(input: { draft: SiteChrome; version: number }): Promise<SiteChromeState> {
  await delay()
  const store = read()
  requireEnabled(store)
  const chrome = chromeOf(store)
  if (chrome.version !== input.version) {
    throw new ApiError(409, "CONCURRENT_MODIFICATION", "Menu dan kaki situs baru saja diubah di tempat lain. Muat ulang editor.")
  }
  store.chrome = { ...chrome, draft: clone(input.draft), version: chrome.version + 1, updated_at: now() }
  write(store)
  return { draft: store.chrome.draft, published: store.chrome.published, version: store.chrome.version }
}

/** POST /v1/site-chrome/publish: draf menjadi yang tampil di seluruh situs. */
export async function publishChrome(input: { version: number }): Promise<SiteChromeState> {
  await delay()
  const store = read()
  requireEnabled(store)
  const chrome = chromeOf(store)
  if (chrome.version !== input.version) {
    throw new ApiError(409, "CONCURRENT_MODIFICATION", "Menu dan kaki situs baru saja diubah di tempat lain. Muat ulang editor.")
  }
  store.chrome = { ...chrome, published: clone(chrome.draft), version: chrome.version + 1, updated_at: now() }
  write(store)
  return { draft: store.chrome.draft, published: store.chrome.published, version: store.chrome.version }
}

/** Navbar dan kaki situs yang terbit, untuk halaman publik. */
export function publishedChrome(): SiteChrome {
  return withDefaults(chromeOf(read()).published)
}

// --- Alat prototipe ------------------------------------------------------------

export function setPagesEnabled(enabled: boolean) {
  const store = read()
  store.enabled = enabled
  write(store)
}

export function resetPrototype() {
  write(seed())
}

// --- Data contoh -----------------------------------------------------------

const legacySample: LegacyContent = {
  about_text:
    "Kami usaha keluarga yang sudah melayani pelanggan di Bandung sejak lama. Kami percaya pekerjaan yang rapi dimulai dari mendengarkan kebutuhan Anda.",
  services: [
    { title: "Konsultasi", description: "Bicarakan kebutuhan Anda dengan tim kami.", icon: "headset" },
    { title: "Pengerjaan", description: "Dikerjakan tim sendiri, tepat waktu.", icon: "wrench" },
    { title: "Pengiriman", description: "Diantar ke alamat Anda.", icon: "truck" },
  ],
  about_image: null,
}

function block(type: string, props: Record<string, unknown>) {
  return { type, props: { id: `${type}-${newId()}`, ...props } }
}

function legacyBlocks(legacy: LegacyContent) {
  return [
    block("ImageText", { title: "Tentang kami", body: legacy.about_text, image: legacy.about_image, image_position: "left" }),
    block("Services", { title: "Layanan kami", items: legacy.services }),
  ]
}

function seed(): Store {
  const at = (daysAgo: number, hour: number) => {
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    date.setHours(hour, 15, 0, 0)
    return date.toISOString()
  }
  const homeV1: Data = {
    root: { props: {} },
    zones: {},
    content: [
      block("Hero", {
        title: "Melayani sepenuh hati, setiap hari",
        subtitle: "Usaha keluarga yang mengerjakan setiap pesanan dengan rapi. Datang langsung, atau hubungi kami.",
        button_label: "Hubungi kami", button_link: "#kontak", image: null, align: "left",
      }),
      block("Services", {
        title: "Yang bisa kami bantu",
        items: [
          { title: "Konsultasi", description: "Bicarakan kebutuhan Anda dengan tim kami.", icon: "headset" },
          { title: "Pengerjaan", description: "Dikerjakan tim sendiri, tepat waktu.", icon: "wrench" },
          { title: "Pengiriman", description: "Diantar ke alamat Anda.", icon: "truck" },
        ],
      }),
      block("Contact", { title: "Mampir atau hubungi kami", note: "Kami senang dihubungi lewat cara yang paling mudah untuk Anda." }),
    ],
  }
  const homeV2: Data = clone(homeV1)
  homeV2.content.splice(2, 0,
    block("Testimonials", {
      title: "Kata pelanggan",
      items: [
        { quote: "Pengerjaannya rapi dan tepat waktu.", name: "Ibu Sari", role: "Pelanggan sejak 2021" },
        { quote: "Timnya ramah, gampang dihubungi.", name: "Pak Andi", role: "Pelanggan" },
      ],
    }),
    block("CallToAction", { title: "Siap mulai?", body: "Ceritakan kebutuhan Anda, kami bantu dari awal.", button_label: "Hubungi kami", button_link: "#kontak", style: "primary" }),
  )

  const servicesV1: Data = {
    root: { props: {} },
    zones: {},
    content: [
      block("Hero", { title: "Layanan", subtitle: "Pilih yang paling pas untuk kebutuhan Anda.", button_label: "", button_link: "", image: null, align: "center" }),
      block("Services", {
        title: "",
        items: [
          { title: "Konsultasi", description: "Gratis untuk pertemuan pertama.", icon: "headset" },
          { title: "Pengerjaan", description: "Dikerjakan tim sendiri.", icon: "wrench" },
        ],
      }),
    ],
  }
  const servicesDraft: Data = clone(servicesV1)
  servicesDraft.content.push(
    block("Faq", {
      title: "Pertanyaan yang sering diajukan",
      items: [
        { question: "Berapa lama pengerjaannya?", answer: "Biasanya satu sampai dua minggu, tergantung jumlahnya." },
        { question: "Bisa dikirim ke luar kota?", answer: "Bisa. Ongkos kirim dihitung saat pemesanan." },
      ],
    }),
  )

  const aboutDraft: Data = {
    root: { props: {} },
    zones: {},
    content: [
      block("Text", { title: "Tentang kami", body: "<p>Ceritakan sejak kapan usaha Anda berdiri, dan apa yang membuatnya berbeda.</p>" }),
    ],
  }

  return {
    enabled: true,
    legacyImported: false,
    pages: [
      {
        id: newId(), path: "/", title: "Beranda", navigation: { visible: false, position: 0 },
        seo: { title: "", description: "", image: null }, status: "published", version: 6,
        published_at: at(0, 9), updated_at: at(0, 9), draft: clone(homeV2), published: clone(homeV2),
        history: [
          { id: newId(), number: 2, title: "Beranda", published_at: at(0, 9), published_by: "Rina Wulandari", data: clone(homeV2) },
          { id: newId(), number: 1, title: "Beranda", published_at: at(3, 14), published_by: "Rina Wulandari", data: clone(homeV1) },
        ],
      },
      {
        id: newId(), path: "/layanan", title: "Layanan", navigation: { visible: true, position: 1 },
        seo: { title: "", description: "Layanan Maju Bersama.", image: null }, status: "changed", version: 4,
        published_at: at(2, 10), updated_at: at(0, 8), draft: servicesDraft, published: clone(servicesV1),
        history: [{ id: newId(), number: 1, title: "Layanan", published_at: at(2, 10), published_by: "Budi Santoso", data: clone(servicesV1) }],
      },
      {
        id: newId(), path: "/tentang", title: "Tentang kami", navigation: { visible: true, position: 2 },
        seo: { title: "", description: "", image: null }, status: "draft", version: 2,
        published_at: null, updated_at: at(1, 16), draft: aboutDraft, published: null, history: [],
      },
    ],
  }
}
