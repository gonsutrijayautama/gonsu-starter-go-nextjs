// Video di halaman hanya dari dua sumber: YouTube (disematkan lewat
// youtube-nocookie) dan Pixabay (berkasnya boleh ditautkan langsung). Alamat
// lain tidak diputar, supaya halaman tidak memuat berkas dari sembarang situs.

export type VideoSource = { kind: "youtube"; id: string } | { kind: "file"; url: string }

/** id video dari tautan YouTube (watch, youtu.be, embed, shorts). Tautan lain ditolak. */
export function youtubeId(url: string): string | null {
  const match = /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(url.trim())
  return match?.[1] ?? null
}

/** Video hanya diputar dari Pixabay, yang mengizinkan videonya ditautkan langsung. */
export function isStockVideo(address: string): boolean {
  try {
    const url = new URL(address)
    return url.protocol === "https:" && (url.hostname === "pixabay.com" || url.hostname.endsWith(".pixabay.com"))
  } catch {
    return false
  }
}

/** Cara memutar alamat ini, atau null bila bukan dari sumber yang dikenal. */
export function videoSource(address: string): VideoSource | null {
  const url = address.trim()
  const id = youtubeId(url)
  if (id) return { kind: "youtube", id }
  return isStockVideo(url) ? { kind: "file", url } : null
}

/** Gambar sampul bawaan YouTube untuk satu video. */
export const youtubePoster = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
