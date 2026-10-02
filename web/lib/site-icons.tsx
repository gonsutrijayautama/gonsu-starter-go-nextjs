import {
  ChartLineIcon,
  ClockIcon,
  HeadsetIcon,
  PackageIcon,
  ShieldIcon,
  SparklesIcon,
  StarIcon,
  StoreIcon,
  TruckIcon,
  UsersIcon,
  WalletIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"

/**
 * Ikon layanan di halaman depan. Namanya sama persis dengan daftar `Icons`
 * modul website di server (gonsu-appkit-go) — server menolak nama lain, jadi
 * menambah ikon berarti menambahnya di library lebih dulu.
 */
export const siteIcons: Record<string, { label: string; icon: LucideIcon }> = {
  package: { label: "Paket", icon: PackageIcon },
  chart: { label: "Grafik", icon: ChartLineIcon },
  wrench: { label: "Perkakas", icon: WrenchIcon },
  headset: { label: "Layanan pelanggan", icon: HeadsetIcon },
  truck: { label: "Pengiriman", icon: TruckIcon },
  shield: { label: "Perlindungan", icon: ShieldIcon },
  star: { label: "Bintang", icon: StarIcon },
  users: { label: "Orang", icon: UsersIcon },
  store: { label: "Toko", icon: StoreIcon },
  clock: { label: "Waktu", icon: ClockIcon },
  wallet: { label: "Dompet", icon: WalletIcon },
  sparkles: { label: "Kilau", icon: SparklesIcon },
}

/** Ikon untuk nama dari server; nama yang belum dikenal frontend ini jatuh ke ikon paket. */
export function siteIcon(name: string): LucideIcon {
  return siteIcons[name]?.icon ?? PackageIcon
}
