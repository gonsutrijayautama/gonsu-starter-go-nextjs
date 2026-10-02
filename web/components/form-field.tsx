"use client";

import type { ReactNode } from "react";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";

/**
 * Bentuk minimal field TanStack Form yang dibutuhkan komponen ini.
 *
 * Sengaja struktural dan bukan tipe generic dari @tanstack/react-form: tipe
 * aslinya membawa belasan parameter generic, dan menuliskannya di sini membuat
 * setiap pemanggil harus ikut menyebutkannya.
 */
export interface ValidatedField {
  name: string;
  state: {
    meta: {
      isTouched: boolean;
      isValid: boolean;
      errors: Array<{ message?: string } | undefined>;
    };
  };
}

export interface FormFieldProps {
  field: ValidatedField;
  label: string;
  /**
   * Id isiannya, bila BERBEDA dari nama fieldnya.
   *
   * Bawaannya `field.name`, dan itu yang benar untuk halaman dengan satu
   * formulir. Dua formulir yang menyunting field bernama sama di satu halaman —
   * "Kunci baru" di halaman dan "Ubah kunci" di panelnya — menghasilkan dua
   * elemen ber-id `name`, dan label yang kedua lalu menunjuk isian yang
   * pertama: mengklik "Nama" di panel memindahkan kursor ke formulir di
   * belakangnya. Yang di panel karena itu memberi id berawalan sendiri.
   */
  inputId?: string;
  /** Keterangan tetap. Disembunyikan saat ada kesalahan, supaya tidak dua baris. */
  description?: ReactNode;
  /**
   * Penolakan dari server untuk kolom ini, bila ada.
   *
   * Tetap ada walau validasi client sudah jalan: sebagian aturan hanya
   * diketahui server — kode promo yang sudah dipakai, email yang sudah
   * terdaftar — dan aturan itu tidak dapat dipindahkan ke peramban.
   */
  serverError?: string;
  /**
   * Isiannya.
   *
   * `id` HARUS sama dengan `field.name`. Label menunjuk ke sana, dan kunci
   * kesalahannya pun nama itu — id yang berbeda dari nama field pernah membuat
   * sembilan isian di halaman produk tidak pernah menampilkan kesalahannya,
   * karena yang dicari `variant-code` sementara Zod mengembalikannya di bawah
   * `code`.
   */
  children: ReactNode;
}

/**
 * Satu isian formulir: label, isian, keterangan, dan kesalahannya.
 *
 * Kesalahan client baru ditampilkan setelah isiannya DISENTUH. Menampilkannya
 * sejak awal berarti formulir yang belum diisi sudah merah seluruhnya, dan
 * warna merah yang selalu ada berhenti berarti apa-apa. `handleSubmit` menandai
 * seluruh field tersentuh, jadi menekan tombol kirim tetap memunculkan
 * semuanya sekaligus.
 */
export function FormField({
  field,
  label,
  inputId,
  description,
  serverError,
  children,
}: FormFieldProps) {
  const meta = field.state.meta;
  const clientInvalid = meta.isTouched && !meta.isValid;

  return (
    <Field data-invalid={clientInvalid || Boolean(serverError) || undefined}>
      <FieldLabel htmlFor={inputId ?? field.name}>{label}</FieldLabel>
      {children}
      {clientInvalid ? (
        <FieldError errors={meta.errors} />
      ) : serverError ? (
        <FieldError>{serverError}</FieldError>
      ) : description ? (
        <FieldDescription>{description}</FieldDescription>
      ) : null}
    </Field>
  );
}
