"use client"

import { CreditCardIcon, LogOutIcon, UserCogIcon } from "lucide-react"

import { Badge } from "@/components/reui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { PersonAvatar } from "./generated-avatar"

export interface UserMenuProps {
  name: string
  email?: string | null
  /** Label role yang sedang berlaku, misalnya "Administrator". */
  role?: string
  /** "Kelola akun" di GONSU; kosong untuk sesi pengembangan. */
  accountUrl?: string
  /** "Kelola langganan" di Portal GONSU; kosong bila tidak boleh tampil. */
  subscriptionUrl?: string
  /** Endpoint keluar; menerima POST. */
  logoutAction?: string
}

/**
 * Identitas pengguna di kanan atas, beserta menunya.
 *
 * Nama DAN role terlihat tanpa membuka menu: yang menentukan apa yang boleh
 * dikerjakan adalah role-nya. Email ada di dalam menu.
 */
export function UserMenu({
  name,
  email,
  role,
  accountUrl,
  subscriptionUrl,
  logoutAction = "/auth/logout",
}: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" className="h-auto gap-2 py-1 pr-2 pl-1" aria-label="Menu akun">
            <PersonAvatar seed={email || name} name={name} className="size-8" />
            <span className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
              <span className="max-w-40 truncate text-sm font-medium">{name}</span>
              {role ? <span className="max-w-40 truncate text-xs text-muted-foreground">{role}</span> : null}
            </span>
          </Button>
        }
      />

      {/* Lebar ditentukan sendiri: bawaannya mengikuti lebar TRIGGER, dan email
          selalu lebih panjang daripada tombolnya. */}
      <DropdownMenuContent align="end" className="w-60">
        {/* DropdownMenuLabel WAJIB di dalam group — kalau tidak Base UI melempar
            "MenuGroupContext is missing". */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex flex-col gap-1 px-1 py-1.5 text-left">
              <span className="truncate text-sm font-medium text-foreground">{name}</span>
              {email ? <span className="truncate text-xs text-muted-foreground">{email}</span> : null}
              {role ? (
                <Badge variant="secondary" className="mt-0.5 w-fit">
                  {role}
                </Badge>
              ) : null}
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {accountUrl ? (
          // Nama, email, sandi, dan verifikasi dua langkah dikelola di GONSU.
          <DropdownMenuItem render={<a href={accountUrl} />}>
            <UserCogIcon />
            Kelola akun
          </DropdownMenuItem>
        ) : null}

        {subscriptionUrl ? (
          // Langganan dan tagihan bisnis ini ada di Portal GONSU.
          <DropdownMenuItem render={<a href={subscriptionUrl} />}>
            <CreditCardIcon />
            Kelola langganan
          </DropdownMenuItem>
        ) : null}

        {accountUrl || subscriptionUrl ? <DropdownMenuSeparator /> : null}

        {/* Form ada DI DALAM menu dan membungkus itemnya: tombolnya men-submit
            form induknya. Keluar mengubah keadaan, jadi POST, bukan tautan.
            `nativeButton` WAJIB: Menu.Item bawaannya me-render div. */}
        <form action={logoutAction} method="post" noValidate>
          <DropdownMenuItem variant="destructive" nativeButton render={<button type="submit" className="w-full" />}>
            <LogOutIcon />
            Keluar
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
