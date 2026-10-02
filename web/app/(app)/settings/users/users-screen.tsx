"use client"

import { useMemo, useState } from "react"
import { EllipsisIcon, InfoIcon, UserPlusIcon } from "lucide-react"
import { cn } from "cn"

import { useResource } from "@/hooks/use-resource"
import { formatDateTime } from "@/lib/format"
import { portalLinks } from "@/lib/portal"
import { Permission } from "@/lib/permissions"
import { roleLabel, type Role } from "@/lib/roles"
import { runWithToast } from "@/lib/toast-action"
import { updateUser, usersPath, type User, type UserList } from "@/lib/users"
import { ApiFailure } from "@/components/api-failure"
import { ConfirmAction } from "@/components/app-shell/confirm-action"
import { PersonAvatar } from "@/components/app-shell/generated-avatar"
import { PageLoading } from "@/components/app-shell/page-loading"
import { DataTable, type ColumnDef, type DataGridFeatures } from "@/components/data-table"
import { PageHeader } from "@/components/page-header"
import { useCan, usePortal } from "@/components/session-provider"
import { Alert, AlertAction, AlertDescription } from "@/components/reui/alert"
import { Badge } from "@/components/reui/badge"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InviteDialog } from "./invite-dialog"

/** Perubahan yang menunggu dikonfirmasi. */
type Pending = { user: User; role?: Role; status?: "ACTIVE" | "SUSPENDED" }

export function UsersScreen() {
  const can = useCan()
  const portal = usePortal()
  const { data, error, loading, reload } = useResource<UserList>(usersPath)
  const [inviting, setInviting] = useState(false)
  // Ubah role dan nonaktifkan MENCABUT sesuatu dari seseorang: pilihannya
  // ditahan di sini sampai dikonfirmasi, bukan langsung dikirim.
  const [pending, setPending] = useState<Pending | null>(null)

  const roles = useMemo(() => data?.assignable_roles ?? [], [data])
  const columns = useMemo<ColumnDef<DataGridFeatures, User>[]>(
    () => [
      {
        id: "name",
        accessorFn: (user) => user.name,
        header: ({ column }) => <DataGridColumnHeader title="Nama" column={column} />,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <PersonAvatar seed={row.original.email || row.original.subject} name={row.original.name} className="size-8" />
            <div className="min-w-0 space-y-px">
              <div className="flex items-center gap-2 font-medium">
                <span className="truncate">{row.original.name}</span>
                {row.original.is_self ? <Badge variant="secondary">Anda</Badge> : null}
              </div>
              {row.original.email ? <div className="truncate text-muted-foreground">{row.original.email}</div> : null}
            </div>
          </div>
        ),
        size: 280,
      },
      {
        id: "role",
        accessorFn: (user) => roleLabel[user.role] ?? user.role,
        header: ({ column }) => <DataGridColumnHeader title="Role" column={column} />,
        size: 140,
      },
      {
        id: "status",
        accessorFn: (user) => (user.status === "ACTIVE" ? "Aktif" : "Nonaktif"),
        header: ({ column }) => <DataGridColumnHeader title="Status" column={column} />,
        cell: ({ row }) =>
          row.original.status === "ACTIVE" ? (
            <Badge variant="success-light">Aktif</Badge>
          ) : (
            <Badge variant="secondary">Nonaktif</Badge>
          ),
        size: 120,
      },
      {
        id: "last_login",
        accessorFn: (user) => user.last_login_at ?? "",
        header: ({ column }) => <DataGridColumnHeader title="Terakhir masuk" column={column} />,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.last_login_at ? formatDateTime(row.original.last_login_at) : "Belum pernah"}
          </span>
        ),
        size: 180,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        size: 56,
        cell: ({ row }) => <UserActions user={row.original} roles={roles} onChange={setPending} />,
      },
    ],
    [roles],
  )

  if (!can(Permission.SettingsUsersManage)) {
    return (
      <>
        <PageHeader title="Pengguna & Akses" />
        <p className="text-sm text-muted-foreground">Role Anda belum bisa mengatur akses pengguna.</p>
      </>
    )
  }

  const seats = data?.seats
  const full = seats?.max != null && seats.active >= seats.max
  const inviteBlocked = !data?.invite.available || full

  function applyPending() {
    if (!pending) return
    const { user, role, status } = pending
    const text = role
      ? { loading: "Mengubah role…", success: `${user.name} sekarang ${roleLabel[role]}` }
      : status === "SUSPENDED"
        ? { loading: "Menonaktifkan pengguna…", success: `${user.name} tidak bisa masuk lagi` }
        : { loading: "Mengaktifkan pengguna…", success: `${user.name} bisa masuk lagi` }
    runWithToast(updateUser(user.id, role ? { role } : { status }), text)
      .then(reload)
      .catch(() => undefined)
  }

  return (
    <>
      <PageHeader
        title="Pengguna & Akses"
        description="Siapa yang boleh masuk ke aplikasi ini, dan boleh apa."
        action={
          <Button onClick={() => setInviting(true)} disabled={!data || inviteBlocked}>
            <UserPlusIcon data-icon="inline-start" />
            Beri akses
          </Button>
        }
      />

      {error ? <ApiFailure error={error} onRetry={reload} /> : null}

      {data && !data.invite.available && data.invite.reason ? (
        <Alert variant="info">
          <InfoIcon />
          <AlertDescription>{data.invite.reason}</AlertDescription>
        </Alert>
      ) : null}
      {full ? (
        <Alert variant="warning">
          <InfoIcon />
          <AlertDescription>
            Kuota pengguna paket ini sudah penuh. Nonaktifkan pengguna yang tidak dipakai, atau{" "}
            {portal ? "naikkan paketnya." : "minta pemilik bisnis menaikkan paketnya."}
          </AlertDescription>
          {portal ? (
            <AlertAction>
              {/* Jalur server (kit GONSU), jadi <a> bergaya tombol, bukan Button. */}
              <a href={portalLinks.plans} className={cn(buttonVariants({ variant: "outline" }))}>
                Lihat paket
              </a>
            </AlertAction>
          ) : null}
        </Alert>
      ) : null}

      {loading && !data ? (
        <PageLoading label="Memuat pengguna…" />
      ) : (
        <DataTable
          title="Pengguna"
          toolbar={
            seats ? (
              <Badge variant="outline">
                {seats.max == null ? `${seats.active} aktif` : `${seats.active} dari ${seats.max} aktif`}
              </Badge>
            ) : null
          }
          data={data?.data ?? []}
          columns={columns}
        />
      )}

      {data ? (
        <InviteDialog open={inviting} onOpenChange={setInviting} roles={data.assignable_roles} onInvited={reload} />
      ) : null}

      <ConfirmAction
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        destructive={pending?.status !== "ACTIVE"}
        title={
          pending?.role
            ? `Ubah role ${pending.user.name}?`
            : pending?.status === "SUSPENDED"
              ? `Nonaktifkan ${pending.user.name}?`
              : `Aktifkan lagi ${pending?.user.name ?? ""}?`
        }
        description={
          pending?.role
            ? `${pending.user.name} jadi ${roleLabel[pending.role]}. Yang boleh ia kerjakan berubah saat itu juga.`
            : pending?.status === "SUSPENDED"
              ? `${pending.user.name} langsung tidak bisa masuk. Datanya tetap tersimpan, dan aksesnya bisa diaktifkan lagi.`
              : `${pending?.user.name ?? ""} bisa masuk lagi dengan role yang sama.`
        }
        confirmLabel={pending?.role ? "Ubah role" : pending?.status === "SUSPENDED" ? "Nonaktifkan" : "Aktifkan"}
        onConfirm={applyPending}
      />
    </>
  )
}

function UserActions({ user, roles, onChange }: { user: User; roles: Role[]; onChange: (pending: Pending) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Aksi untuk ${user.name}`} />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-fit">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Ubah role</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-fit">
            <DropdownMenuRadioGroup
              value={user.role}
              onValueChange={(role: Role) => role !== user.role && onChange({ user, role })}
            >
              {roles.map((role) => (
                <DropdownMenuRadioItem key={role} value={role}>
                  {roleLabel[role]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {!user.is_self ? (
          <>
            <DropdownMenuSeparator />
            {user.status === "ACTIVE" ? (
              <DropdownMenuItem variant="destructive" onClick={() => onChange({ user, status: "SUSPENDED" })}>
                Nonaktifkan
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onChange({ user, status: "ACTIVE" })}>Aktifkan lagi</DropdownMenuItem>
            )}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
