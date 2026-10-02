import type { Site } from "@/lib/site"

/**
 * Bagian halaman depan yang ADA untuk sebuah bisnis. Menu, tombol, dan kaki
 * halaman hanya menaut ke bagian yang benar-benar dirender: tautan ke bagian
 * kosong hanya menggulung ke tempat yang tidak ada apa-apanya.
 */
export function siteSections(site: Site) {
  const { contact } = site
  return {
    about: Boolean(site.about.text || site.about.image_url),
    services: site.services.length > 0,
    contact: Boolean(contact.address || contact.city || contact.email || contact.phone || contact.hours),
  }
}

/** Tautan ke bagian yang ada, urut seperti di halaman. */
export function sectionLinks(site: Site): { href: string; title: string }[] {
  const has = siteSections(site)
  return [
    ...(has.about ? [{ href: "#tentang", title: "Tentang kami" }] : []),
    ...(has.services ? [{ href: "#layanan", title: "Layanan" }] : []),
    ...(has.contact ? [{ href: "#kontak", title: "Kontak" }] : []),
  ]
}
