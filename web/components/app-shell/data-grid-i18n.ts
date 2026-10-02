import type { DataGridI18nOverrides } from "@/components/reui/data-grid/data-grid-i18n";

/**
 * Label DataGrid dalam bahasa Indonesia.
 *
 * Bawaan reui seluruhnya bahasa Inggris ("Rows per page", "1 - 5 of 5"), dan
 * itu tidak akan pernah memberi galat — ia hanya muncul sebagai satu-satunya
 * bagian berbahasa Inggris di tengah halaman berbahasa Indonesia, dan biasanya
 * baru disadari setelah ada yang membacanya dengan teliti.
 *
 * Ditulis SEKALI di sini dan dipakai `DataTable`. Menempelkannya per tabel
 * berarti tabel kesebelas akan lupa, dan tidak ada yang menjaganya.
 */
export const dataGridI18nID: DataGridI18nOverrides = {
  labels: {
    sortAscending: "Naik",
    sortDescending: "Turun",
    pinColumnStart: "Sematkan ke kiri",
    pinColumnEnd: "Sematkan ke kanan",
    moveColumnStart: "Pindah ke kiri",
    moveColumnEnd: "Pindah ke kanan",
    columnsMenu: "Kolom",
    unpinColumn: (title) => `Lepaskan sematan kolom ${title}`,
    toggleColumns: "Atur kolom",
    rowCreate: "Tambah baris",
    pinRow: "Sematkan baris",
    unpinRow: "Lepaskan sematan baris",
    selectRow: "Pilih baris",
    selectAll: "Pilih semua",
    expandRow: "Buka baris",
    collapseRow: "Tutup baris",
    dragToReorder: "Seret untuk mengurutkan",
    dragToReorderRow: "Seret untuk memindahkan baris",
    reorderingUnavailable: "Pengurutan tidak tersedia",
    loading: "Memuat…",
    empty: "Belum ada data",
    allRowsLoaded: "Seluruh data sudah dimuat",
    rowsPerPage: "Baris per halaman",
    paginationInfo: ({ from, to, count }) => `${from}–${to} dari ${count}`,
    previousPage: "Halaman sebelumnya",
    nextPage: "Halaman berikutnya",
    goToPage: (page) => `Ke halaman ${page}`,
    paginationEllipsis: "…",
    filterSelectedCount: (count) => `${count} dipilih`,
    filterNoResults: "Tidak ada yang cocok.",
    filterClear: "Hapus penyaring",
  },
};
