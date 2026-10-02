"use client";

import { useState, type ReactNode } from "react";
import {
  useTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";

// data-grid adalah DIREKTORI tanpa index — tiap simbol dari berkasnya.
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { dataGridI18nID } from "@/components/app-shell/data-grid-i18n";

export type { ColumnDef, DataGridFeatures };

export interface DataTableProps<TData extends object> {
  data: TData[];
  columns: ColumnDef<DataGridFeatures, TData>[];
  /** Seluruh baris dapat diklik, bukan hanya satu kolom di dalamnya. */
  onRowClick?: (row: TData) => void;
  /** Disembunyikan bila barisnya sedikit; total tetap disebut di dalamnya. */
  pagination?: boolean;
  /**
   * Judul di kepala Frame.
   *
   * Diisi berarti tabelnya membawa bingkainya sendiri — kepala berisi judul dan
   * peralatan, isi bergulir, paginasi di kaki. Setiap tabel WAJIB berbingkai
   * (docs/ui-guide.md): isi `title`.
   */
  title?: ReactNode;
  description?: ReactNode;
  /**
   * Penyaring yang MENGGANTI daftarnya, mis. tab status. Tampil di kiri, di
   * samping judul — pencarian dan aksi tetap di `toolbar` sebelah kanan.
   */
  filters?: ReactNode;
  /** Pencarian, penyaring, dan aksi; tampil di kanan judul. */
  toolbar?: ReactNode;
  /** Tambahan di kaki, mis. bilah simpan. Menggantikan paginasi bila diisi. */
  footer?: ReactNode;
  emptyMessage?: string;
}

/**
 * Tabel data aplikasi.
 *
 * Membungkus DataGrid sekali di sini: `useTable`, `dataGridFeatures`,
 * `recordCount`, label Indonesia, pengurutan, dan paginasi. Menyusunnya di tiap
 * halaman berarti banyak tempat yang harus ingat kelimanya — dan yang lupa
 * label i18n akan menampilkan "Rows per page" di tengah halaman berbahasa
 * Indonesia tanpa satu pun galat.
 *
 * Bentuk berbingkainya sama dengan tabel GONSU One: `Frame stacked` dengan
 * judul dan peralatan di kepala, `DataGridScrollArea` untuk isinya, dan
 * paginasi di kaki. Tabel yang lebar karena itu bergulir di dalam bingkainya,
 * bukan mendorong seluruh halaman ke samping.
 */
export function DataTable<TData extends object>({
  data,
  columns,
  onRowClick,
  pagination = true,
  title,
  description,
  filters,
  toolbar,
  footer,
  emptyMessage,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [paginationState, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const table = useTable({
    features: dataGridFeatures,
    data,
    columns,
    pageCount: Math.ceil(data.length / paginationState.pageSize),
    // Kolom aksi (id "actions") disematkan di kanan: di layar sempit tabelnya
    // bergulir ke samping, dan tombol aksinya tetap terlihat.
    state: {
      sorting,
      pagination: paginationState,
      columnPinning: { start: [], end: columns.some((column) => column.id === "actions") ? ["actions"] : [] },
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  });

  const hasHeader = title !== undefined || filters !== undefined || toolbar !== undefined;
  const framed = hasHeader || footer !== undefined;

  return (
    <DataGrid
      table={table}
      recordCount={data.length}
      i18n={dataGridI18nID}
      onRowClick={onRowClick}
      emptyMessage={emptyMessage}
      tableLayout={{ columnsPinnable: true }}
    >
      {framed ? (
        <Frame className="w-full" stacked>
          {hasHeader ? (
            <FrameHeader className="flex w-full flex-row flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {title !== undefined || description !== undefined ? (
                  <div className="space-y-1">
                    {title !== undefined ? <FrameTitle>{title}</FrameTitle> : null}
                    {description !== undefined ? (
                      <FrameDescription>{description}</FrameDescription>
                    ) : null}
                  </div>
                ) : null}
                {filters}
              </div>
              {toolbar !== undefined ? (
                <div className="flex flex-wrap items-center gap-2.5">{toolbar}</div>
              ) : null}
            </FrameHeader>
          ) : null}

          <FramePanel className="p-0 shadow-none">
            <DataGridScrollArea>
              <DataGridTable />
            </DataGridScrollArea>
          </FramePanel>

          {footer !== undefined ? (
            <FrameFooter className="py-1.5 pr-2 pl-2.5">{footer}</FrameFooter>
          ) : pagination ? (
            <FrameFooter className="py-1.5 pr-2 pl-2.5">
              <DataGridPagination />
            </FrameFooter>
          ) : null}
        </Frame>
      ) : (
        <>
          <DataGridContainer>
            <DataGridTable />
          </DataGridContainer>
          {pagination ? <DataGridPagination /> : null}
        </>
      )}
    </DataGrid>
  );
}
