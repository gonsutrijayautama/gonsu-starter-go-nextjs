"use client"

import { useMemo, useState } from "react"
import { EllipsisIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react"

import { useResource } from "@/hooks/use-resource"
import { formatDateTime } from "@/lib/format"
import { deleteNote, notesPath, type Note } from "@/lib/notes"
import { Permission } from "@/lib/permissions"
import { runWithToast } from "@/lib/toast-action"
import { ApiFailure } from "@/components/api-failure"
import { ConfirmAction } from "@/components/app-shell/confirm-action"
import { PageLoading } from "@/components/app-shell/page-loading"
import { DataTable, type ColumnDef, type DataGridFeatures } from "@/components/data-table"
import { PageHeader } from "@/components/page-header"
import { useCan } from "@/components/session-provider"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { NoteDialog } from "./note-dialog"

export function NotesScreen() {
  const can = useCan()
  const canWrite = can(Permission.NotesWrite)
  const { data, error, loading, reload } = useResource<{ data: Note[] }>(notesPath)
  const [query, setQuery] = useState("")
  // null: dialog tertutup; "new": catatan baru; Note: mengubah catatan itu.
  const [editing, setEditing] = useState<Note | "new" | null>(null)
  const [deleting, setDeleting] = useState<Note | null>(null)

  const notes = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = data?.data ?? []
    return q ? all.filter((n) => `${n.title} ${n.body}`.toLowerCase().includes(q)) : all
  }, [data, query])

  const columns = useMemo<ColumnDef<DataGridFeatures, Note>[]>(
    () => [
      {
        id: "title",
        accessorFn: (note) => note.title,
        header: ({ column }) => <DataGridColumnHeader title="Judul" column={column} />,
        cell: ({ row }) => (
          <div className="min-w-0 max-w-md">
            <div className="truncate font-medium">{row.original.title}</div>
            {row.original.body ? <div className="truncate text-muted-foreground">{row.original.body}</div> : null}
          </div>
        ),
        size: 360,
      },
      {
        id: "author",
        accessorFn: (note) => note.created_by_name,
        header: ({ column }) => <DataGridColumnHeader title="Dibuat oleh" column={column} />,
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.created_by_name}</span>,
        size: 200,
      },
      {
        id: "updated",
        accessorFn: (note) => note.updated_at,
        header: ({ column }) => <DataGridColumnHeader title="Diubah" column={column} />,
        cell: ({ row }) => <span className="text-muted-foreground">{formatDateTime(row.original.updated_at)}</span>,
        size: 180,
      },
      ...(canWrite
        ? [
          {
            id: "actions",
            header: "",
            enableSorting: false,
            size: 56,
            cell: ({ row }) => (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon" aria-label={`Aksi untuk ${row.original.title}`} />}
                >
                  <EllipsisIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-fit">
                  <DropdownMenuItem onClick={() => setEditing(row.original)}>
                    <PencilIcon />
                    Ubah
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleting(row.original)}>
                    <Trash2Icon />
                    Hapus
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          } satisfies ColumnDef<DataGridFeatures, Note>,
        ]
        : []),
    ],
    [canWrite],
  )

  if (!can(Permission.NotesRead)) {
    return (
      <>
        <PageHeader title="Catatan" />
        <p className="text-sm text-muted-foreground">Role Anda belum bisa membuka catatan.</p>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Catatan"
        description="Catatan bersama untuk tim."
        action={
          canWrite ? (
            <Button onClick={() => setEditing("new")}>
              <PlusIcon data-icon="inline-start" />
              Catatan baru
            </Button>
          ) : null
        }
      />

      {error ? <ApiFailure error={error} onRetry={reload} /> : null}

      {loading && !data ? (
        <PageLoading label="Memuat catatan…" />
      ) : (
        <DataTable
          title="Semua catatan"
          toolbar={
            // Pencarian tinggal DI DALAM kepala Frame, bukan baris terpisah di atasnya.
            <InputGroup className="w-full bg-background sm:w-56">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari catatan"
                aria-label="Cari catatan"
              />
            </InputGroup>
          }
          data={notes}
          columns={columns}
          emptyMessage={query ? "Tidak ada catatan yang cocok." : "Belum ada catatan."}
        />
      )}

      <NoteDialog
        note={editing === "new" ? undefined : (editing ?? undefined)}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={() => {
          setEditing(null)
          reload()
        }}
      />

      <ConfirmAction
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        destructive
        title="Hapus catatan ini?"
        description={`"${deleting?.title ?? ""}" hilang untuk seluruh tim dan tidak bisa dikembalikan.`}
        confirmLabel="Hapus"
        onConfirm={() => {
          if (!deleting) return
          runWithToast(deleteNote(deleting.id), { loading: "Menghapus catatan…", success: "Catatan dihapus" })
            .then(reload)
            .catch(() => undefined)
        }}
      />
    </>
  )
}
