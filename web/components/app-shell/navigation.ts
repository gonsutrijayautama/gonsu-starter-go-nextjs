/**
 * Aturan navigasi sidebar yang tidak bergantung pada React, supaya dapat diuji
 * langsung dengan `node --test`.
 */

/**
 * Apakah menu dengan `url` ini aktif pada `pathname`.
 *
 * Menu `exact` hanya aktif pada alamatnya sendiri — bawaannya untuk `/`, dan
 * wajib untuk beranda yang alamatnya awalan menu lain. Menu lain juga aktif
 * pada halaman turunannya. Batasnya segmen utuh — `/notes` tidak boleh ikut
 * menyala di `/notes-archive`.
 */
export function isNavItemActive(
  url: string,
  pathname: string,
  exact: boolean = url === "/",
): boolean {
  // Static export memakai garis miring penutup (`/notes/`); pembandingnya
  // dinormalkan supaya `/notes` dan `/notes/` dianggap alamat yang sama.
  const target = trimSlash(url)
  const current = trimSlash(pathname)
  if (exact) return current === target
  return current === target || current.startsWith(`${target}/`)
}

function trimSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path
}

export interface NavLink {
  url: string
  exact?: boolean
}

export interface SectionLinks {
  id: string
  links: readonly NavLink[]
}

/**
 * Section yang memuat halaman yang sedang dibuka — satu-satunya penentu menu
 * sidebar yang tampil (tidak ada tab untuk memilihnya).
 *
 * Membuka `/settings/users/` langsung dari tautan harus menampilkan menu
 * Pengaturan yang memuatnya; kalau tidak, menu yang aktif tidak terlihat dan
 * tidak ada yang menyala. Alamat yang tidak dimiliki section mana pun jatuh ke section
 * pertama.
 *
 * `/` dikecualikan dari pencocokan: ia awalan setiap alamat, dan section yang
 * memuatnya akan memenangkan setiap halaman bila ikut dicocokkan.
 */
export function sectionForPath(
  pathname: string,
  sections: readonly SectionLinks[],
): string | undefined {
  const owner = sections.find((section) =>
    section.links.some(
      (link) => link.url !== "/" && isNavItemActive(link.url, pathname, link.exact),
    ),
  )
  return (owner ?? sections[0])?.id
}
