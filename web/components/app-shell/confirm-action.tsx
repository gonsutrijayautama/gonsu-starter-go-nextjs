"use client";

import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export interface ConfirmActionProps {
  /**
   * Tombol yang membuka konfirmasi.
   *
   * Opsional: sebagian aksi tidak dipicu tombol melainkan perubahan pilihan
   * (mengganti peran staf dari sebuah Select). Untuk itu pakai `open` +
   * `onOpenChange` dan biarkan trigger-nya kosong — supaya TIDAK ada lagi
   * AlertDialog yang ditulis tangan di luar komponen ini, yang justru menjadi
   * sebab tombol konfirmasinya kadang default kadang destructive.
   */
  trigger?: React.ReactElement;
  /** Dikendalikan dari luar bila tidak ada trigger. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  /** Sebutkan APA yang akan terjadi, bukan "apakah Anda yakin". */
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Merah untuk yang tidak dapat dibatalkan. */
  destructive?: boolean;
  /** Dijalankan setelah dikonfirmasi — biasanya panggilan API dengan toast. */
  onConfirm?: () => void;
}

/**
 * Konfirmasi untuk aksi yang MENGUBAH sesuatu.
 *
 * Dipakai untuk setiap aksi yang mengubah keadaan, bukan hanya yang merusak:
 * menyetujui pengajuan, menaikkan harga, mengumumkan produk, mencabut akses.
 * Yang dijaga di sini bukan keraguan pengguna melainkan klik yang tidak
 * sengaja — satu klik keliru dapat menghapus data tim atau mengunci seorang
 * karyawan dari aplikasinya.
 *
 * Deskripsinya wajib menyebut apa yang akan terjadi. "Apakah Anda yakin?"
 * tidak menambah informasi apa pun dan justru melatih orang menekan Lanjut
 * tanpa membaca.
 */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel = "Lanjutkan",
  cancelLabel = "Batal",
  destructive = false,
  onConfirm,
  open,
  onOpenChange,
}: ConfirmActionProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isOpen = open ?? uncontrolledOpen;

  function setOpen(next: boolean) {
    if (open === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  // `AlertDialogAction` shadcn hanyalah Button, BUKAN Close milik Base UI:
  // menekannya tidak menutup dialog. Tanpa penutupan eksplisit di sini dialog
  // tetap terbuka sesudah dikonfirmasi — hanya tampak benar bila komponennya
  // kebetulan ikut hilang karena halaman berganti.
  function confirm() {
    onConfirm?.();
    setOpen(false);
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? <AlertDialogTrigger render={trigger} /> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel render={<Button variant="outline" />}>
            {cancelLabel}
          </AlertDialogCancel>
          {/* `variant` langsung ke AlertDialogAction, yang sendiri sudah Button.
              Membungkus Button lain lewat `render` membuat kelas varian default
              ikut menempel dan menang — tombolnya tampil primary, bukan merah.

              Varian `destructive` bawaan shadcn bergaya TERSIRAT (bg-destructive/10
              + teks merah): di dialog konfirmasi ia terbaca seperti tombol yang
              dimatikan. Karena itu dibuat padat di sini saja, lewat className. */}
          <AlertDialogAction
            type="button"
            variant={destructive ? "destructive" : "default"}
            className={
              destructive
                ? "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90"
                : undefined
            }
            onClick={confirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
