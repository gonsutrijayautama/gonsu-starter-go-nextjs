import { PageLoading } from "@/components/app-shell/page-loading"

// Tampil selama berpindah halaman di area aplikasi. Satu PageLoading untuk
// semua rute, bukan disalin per rute.
export default function Loading() {
  return <PageLoading />
}
