"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Pemilih tema.
 *
 * RadioGroup, bukan daftar item biasa: pilihannya tunggal dan saling meniadakan,
 * dan hanya radio yang menunjukkan mana yang sedang berlaku tanpa perlu ditandai
 * sendiri.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          // Kedua ikon dirender, yang tampil ditentukan kelas `dark` lewat CSS.
          //
          // Sengaja BUKAN menyimpan "sudah mounted" di state: tema hanya
          // diketahui di browser, dan menunggu effect untuk memilih ikon berarti
          // menulis state di dalam effect — yang memicu render berantai dan
          // membuat ikonnya berganti sendiri sesaat setelah halaman muncul.
          // CSS sudah tahu jawabannya sebelum React sempat bertanya.
          <Button variant="ghost" size="icon" aria-label="Ganti tema">
            <Sun className="size-4 dark:hidden" />
            <Moon className="hidden size-4 dark:block" />
          </Button>
        }
      />
      {/* `w-fit` WAJIB di sini. Bawaannya `w-(--anchor-width)`: lebar popup
          mengikuti lebar TRIGGER — dan trigger ini tombol ikon, sehingga
          popupnya jatuh ke `min-w-32` dan "Ikuti sistem" terpotong ke baris
          kedua. `w-fit` adalah kelas yang dipakai blok sidebar-07 untuk ini. */}
      <DropdownMenuContent align="end" className="w-fit">
        {/* `?? "system"` bukan hiasan: next-themes mengembalikan undefined sampai
            komponennya mounted, dan RadioGroup yang value-nya berpindah dari
            undefined ke nilai berarti komponen tak terkendali yang berubah
            menjadi terkendali — React memperingatkannya, dan pilihan yang
            sedang berlaku sesaat tidak tertandai. */}
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun /> Terang
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon /> Gelap
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor /> Ikuti sistem
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
