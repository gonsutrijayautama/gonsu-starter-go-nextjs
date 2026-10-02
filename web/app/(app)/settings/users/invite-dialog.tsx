"use client"

import { useState } from "react"
import { z } from "zod"

import { useApiForm } from "@/hooks/use-api-form"
import { roleDescription, roleLabel, type Role } from "@/lib/roles"
import { inviteUser, type InviteResult } from "@/lib/users"
import { ApiForm } from "@/components/api-form"
import { FormField } from "@/components/form-field"
import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader, CodeBlockTitle } from "@/components/reui/code-block/code-block"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/**
 * Memberi akses login lewat email. GONSU membuatkan akunnya bila orang itu
 * belum punya; sandi sementaranya tampil SEKALI di sini dan tidak disimpan di
 * mana pun.
 */
export function InviteDialog({
  open,
  onOpenChange,
  roles,
  onInvited,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles: Role[]
  onInvited: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? <InviteFlow roles={roles} onInvited={onInvited} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function InviteFlow({ roles, onInvited, onClose }: { roles: Role[]; onInvited: () => void; onClose: () => void }) {
  const [result, setResult] = useState<InviteResult | null>(null)
  if (result?.temporary_password) return <TemporaryPassword result={result} onClose={onClose} />
  return (
    <InviteForm
      roles={roles}
      onCancel={onClose}
      onInvited={(res) => {
        onInvited()
        if (res.temporary_password) setResult(res)
        else onClose()
      }}
    />
  )
}

// Aturan yang SAMA dengan server (internal/authn/users.go).
function inviteSchema(roles: Role[]) {
  return z.object({
    email: z.email("Isi alamat email yang valid."),
    display_name: z.string().trim().min(1, "Nama wajib diisi.").max(200, "Nama maksimal 200 karakter."),
    role: z.enum(roles as [Role, ...Role[]], "Pilih role yang tersedia."),
  })
}

function InviteForm({
  roles,
  onCancel,
  onInvited,
}: {
  roles: Role[]
  onCancel: () => void
  onInvited: (result: InviteResult) => void
}) {
  const { form, isPending, serverErrors } = useApiForm({
    schema: inviteSchema(roles),
    defaultValues: { email: "", display_name: "", role: roles.includes("staff") ? "staff" : roles[0] },
    submit: (values) => inviteUser(values),
    toast: {
      loading: "Memberi akses…",
      success: (res) =>
        res.account === "created"
          ? { title: "Akun GONSU dibuat", description: `Berikan sandi sementara ke ${res.user.name}.` }
          : { title: "Akses diberikan", description: `${res.user.name} bisa langsung masuk pakai akun GONSU-nya.` },
    },
    onSuccess: onInvited,
  })

  return (
    <ApiForm form={form} isPending={isPending} submitLabel="Beri akses" onCancel={onCancel} Footer={DialogFooter}>
      <DialogHeader>
        <DialogTitle>Beri akses</DialogTitle>
        <DialogDescription>Orang ini masuk pakai akun GONSU. Kalau belum punya, akunnya dibuatkan.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <form.Field name="email">
          {(field) => (
            <FormField field={field} label="Email" serverError={serverErrors.email}>
              {/* type="email" untuk keyboard ponsel; formnya noValidate, jadi
                  pesan Zod yang tampil, bukan gelembung peramban. */}
              <Input
                id={field.name}
                name={field.name}
                type="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                aria-required
                autoFocus
              />
            </FormField>
          )}
        </form.Field>
        <form.Field name="display_name">
          {(field) => (
            <FormField field={field} label="Nama" description="Nama yang tampil di aplikasi." serverError={serverErrors.display_name}>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                aria-required
              />
            </FormField>
          )}
        </form.Field>
        <form.Field name="role">
          {(field) => (
            <FormField field={field} label="Role" description={roleDescription[field.state.value as Role]} serverError={serverErrors.role}>
              {/* `items` supaya SelectValue menampilkan label, bukan nilai mentah. */}
              <Select
                items={roles.map((role) => ({ value: role, label: roleLabel[role] }))}
                value={field.state.value}
                onValueChange={(value) => value && field.handleChange(value as Role)}
              >
                <SelectTrigger id={field.name} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleLabel[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
        </form.Field>
      </FieldGroup>
    </ApiForm>
  )
}

function TemporaryPassword({ result, onClose }: { result: InviteResult; onClose: () => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Akun GONSU dibuat</DialogTitle>
        <DialogDescription>
          Berikan sandi sementara ini ke {result.user.name} ({result.user.email}). Sandi ini hanya tampil
          sekali, dan harus diganti saat pertama masuk.
        </DialogDescription>
      </DialogHeader>
      {/* Teks berbentuk kode apa pun memakai CodeBlock, yang membawa tombol salin. */}
      <CodeBlock code={result.temporary_password ?? ""} highlight={false}>
        <CodeBlockHeader>
          <CodeBlockTitle>Sandi sementara</CodeBlockTitle>
          <CodeBlockCopyButton className="ml-auto" labels={{ copy: "Salin", copied: "Tersalin" }} />
        </CodeBlockHeader>
      </CodeBlock>
      <DialogFooter>
        <Button onClick={onClose}>Selesai</Button>
      </DialogFooter>
    </>
  )
}
