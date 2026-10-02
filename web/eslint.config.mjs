import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

// Komponen vendor dipasang CLI (shadcn dan ReUI), bukan ditulis di sini.
// hooks/use-file-upload.ts adalah hook ReUI (@reui/use-file-upload).
const vendor = ["components/ui/**", "components/reui/**", "hooks/use-file-upload.ts"]

// Warna palet Tailwind langsung (bg-red-500, text-indigo-600, …). Seluruh warna
// lewat token di app/globals.css (docs/ui-guide.md §8).
const paletteColor =
  "/\\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|divide|shadow)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\\d{2,3}\\b|\\[#[0-9a-fA-F]{3,8}\\]/"

/**
 * Aturan docs/ui-guide.md yang dapat diperiksa mesin. Pelanggarannya gagal di
 * `make lint` — agen AI maupun manusia tidak dapat melewatkannya diam-diam.
 * Pesan tiap aturan menyebut penggantinya.
 */
const uiGuide = {
  files: ["**/*.{ts,tsx}"],
  ignores: vendor,
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          { name: "sonner", message: "Toast memakai Base UI: import { toast } from \"@/components/ui/toast\", atau runWithToast dari @/lib/toast-action." },
          { name: "next/font/google", message: "Font disimpan di fonts/ dan dimuat next/font/local; build tidak boleh bergantung pada jaringan ke Google." },
          { name: "@/components/ui/card", message: "Wadah memakai Frame (@/components/reui/frame), bukan Card." },
          { name: "@/components/ui/table", message: "Tabel memakai DataTable (@/components/data-table), yang membungkus DataGrid dalam Frame stacked." },
          { name: "@/components/ui/alert", message: "Pesan penting memakai Alert ReUI (@/components/reui/alert), yang punya varian success/warning/info." },
          { name: "@/components/ui/badge", message: "Label status memakai Badge ReUI (@/components/reui/badge)." },
          { name: "@/components/ui/alert-dialog", message: "Konfirmasi memakai ConfirmAction (@/components/app-shell/confirm-action), satu-satunya pintu AlertDialog." },
        ],
      },
    ],
    "no-restricted-syntax": [
      "error",
      {
        selector: "JSXOpeningElement[name.name='Badge'] > JSXAttribute[name.name='size']",
        message: "Badge tidak pernah memakai prop size — biarkan ukuran bawaannya.",
      },
      {
        // Satu-satunya pengecualian: tombol yang isinya HANYA ikon memakai
        // size="icon" (atau icon-xs/icon-sm/icon-lg) supaya persegi.
        selector: "JSXOpeningElement[name.name='Button'] > JSXAttribute[name.name='size']:not([value.value=/^icon(-(xs|sm|lg))?$/])",
        message: "Button tidak memakai size sm/lg/xs — biarkan ukuran bawaannya. Tombol yang isinya hanya ikon: size=\"icon\".",
      },
      {
        selector: "JSXAttribute[name.name='asChild']",
        message: "Base UI memakai render, bukan asChild.",
      },
      {
        selector: "JSXOpeningElement[name.name='Button'] > JSXAttribute[name.name='render'] JSXOpeningElement[name.name=/^(a|Link)$/]",
        message: "Tautan bukan Button. Pakai <Link>/<a> dengan className={cn(buttonVariants(...))}.",
      },
      {
        selector: "JSXAttribute[name.name='required']",
        message: "Jangan memakai required native: peramban menghentikan kiriman sebelum Zod jalan. Pakai aria-required dan skemanya.",
      },
      {
        selector: "JSXOpeningElement[name.name='form']:not(:has(JSXAttribute[name.name='noValidate']))",
        message: "Setiap <form> wajib noValidate supaya pesan Zod yang tampil, bukan gelembung peramban. Formulir data memakai ApiForm.",
      },
      {
        selector: "JSXOpeningElement[name.name=/^(table|select|textarea|pre)$/]",
        message: "Elemen HTML mentah: pakai DataTable, Select/NativeSelect, Textarea, atau CodeBlock.",
      },
      {
        selector: "JSXOpeningElement[name.name='input']",
        message: "Input mentah: pakai Input, Checkbox, NumberField (ReUI), atau komponen shadcn lain.",
      },
      {
        selector: "CallExpression[callee.name='fetch']",
        message: "Panggilan server lewat api() dari @/lib/api — satu tempat untuk sesi, envelope galat, dan halaman masuk.",
      },
      {
        selector: "CallExpression[callee.name=/^(alert|confirm|prompt)$/], CallExpression[callee.object.name='window'][callee.property.name=/^(alert|confirm|prompt)$/]",
        message: "Dialog bawaan peramban: pakai ConfirmAction atau toast.",
      },
      {
        selector: `Literal[value=${paletteColor}]`,
        message: "Warna palet langsung: pakai token (bg-primary, text-muted-foreground, text-destructive, …).",
      },
      {
        selector: `TemplateElement[value.raw=${paletteColor}]`,
        message: "Warna palet langsung: pakai token (bg-primary, text-muted-foreground, text-destructive, …).",
      },
    ],
  },
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  uiGuide,
  // Satu-satunya tempat fetch dan AlertDialog.
  { files: ["lib/api.ts"], rules: { "no-restricted-syntax": "off" } },
  // Uji e2e memanggil server langsung dengan sengaja: yang dibuktikan adalah
  // server menolak, bukan tombolnya tersembunyi.
  { files: ["e2e/**"], rules: { "no-restricted-syntax": "off" } },
  {
    files: ["components/app-shell/confirm-action.tsx"],
    rules: { "no-restricted-imports": "off" },
  },
  // Kode vendor TIDAK dikecualikan dari lint; hanya aturan gaya React
  // Compiler dan `any` yang dilonggarkan. Memperbaikinya berarti menulis ulang
  // kode pihak ketiga yang akan ditimpa lagi oleh `shadcn add` berikutnya.
  {
    files: vendor,
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/incompatible-library": "off",
      "jsx-a11y/role-supports-aria-props": "off",
    },
    linterOptions: { reportUnusedDisableDirectives: "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
])

export default eslintConfig
