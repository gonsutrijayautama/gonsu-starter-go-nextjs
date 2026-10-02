#!/usr/bin/env bash
# Memeriksa manifes starter kit (gonsu.kit.json) terhadap isi repository.
# Berkas ini milik kit: `gonsu new` membuangnya dari project hasil.
#
# Yang dijaga adalah syarat penggantian identitas oleh `gonsu new`: setiap
# nilai contoh diganti di SETIAP berkas teks, jadi nilai itu harus ada, harus
# saling lepas, dan tidak boleh tersasar ke berkas kunci atau vendor.
set -euo pipefail

manifest=gonsu.kit.json
fail=0
err() {
  echo "kit-check: $*" >&2
  fail=1
}

command -v jq >/dev/null || { echo "kit-check: butuh jq" >&2; exit 2; }
jq -e . "$manifest" >/dev/null || { echo "kit-check: $manifest bukan JSON yang sah" >&2; exit 2; }

[ "$(jq -r '.schema' "$manifest")" = "1" ] || err "schema harus 1"
[ -n "$(jq -r '.kit // empty' "$manifest")" ] || err "kit wajib diisi"

code=$(jq -r '.identity.product_code // empty' "$manifest")
name=$(jq -r '.identity.display_name // empty' "$manifest")
module=$(jq -r '.identity.module_path // empty' "$manifest")
[ -n "$code" ] || err "identity.product_code wajib diisi"
[ -n "$name" ] || err "identity.display_name wajib diisi"

# Berkas yang dilacak git, tanpa manifesnya sendiri dan tanpa berkas milik kit
# (yang memang menyebut nilai contoh untuk menjelaskannya).
mapfile -t kit_files < <(jq -r '.remove[]' "$manifest")
is_kit_file() {
  local f
  for f in "${kit_files[@]}"; do [ "$1" = "$f" ] && return 0; done
  return 1
}
mapfile -t tracked < <(git ls-files)
files=()
for f in "${tracked[@]}"; do is_kit_file "$f" || files+=("$f"); done

count() { grep -lF -- "$1" "${files[@]}" 2>/dev/null | wc -l; }

# 1. Setiap nilai contoh dipakai; manifes yang menyebut nilai yang sudah tidak
#    ada berarti identitas produk tidak akan tertulis di mana pun.
for value in "$code" "$name" ${module:+"$module"}; do
  [ "$(count "$value")" -gt 0 ] || err "nilai contoh \"$value\" tidak dipakai berkas mana pun"
done

# 2. Nilai contoh saling lepas: penggantian satu lintasan mengandaikan tidak
#    ada nilai yang menjadi bagian dari nilai lain.
if [ -n "$module" ]; then
  case "$module" in *"$code"*) err "product_code \"$code\" adalah bagian dari module_path" ;; esac
fi
case "$name" in *"$code"*) err "product_code \"$code\" adalah bagian dari display_name" ;; esac

# 3. Tidak tersasar ke berkas kunci dan vendor: di sana penggantian merusak
#    checksum atau kode pihak lain.
locked='^(go\.sum|web/bun\.lock|web/components/(ui|reui)/|web/fonts/)'
for value in "$code" "$name" ${module:+"$module"}; do
  while IFS= read -r f; do
    [ -n "$f" ] && err "nilai contoh \"$value\" muncul di $f (berkas kunci atau vendor)"
  done < <(grep -lF -- "$value" "${files[@]}" 2>/dev/null | grep -E "$locked" || true)
done

# 4. Nama tampilan hanya di Markdown dan di dalam string kode: di tempat lain
#    `gonsu new` menuliskannya apa adanya, dan nama berisi tanda kutip atau
#    titik dua akan merusak berkasnya.
while IFS= read -r f; do
  case "$f" in
    *.md | *.ts | *.tsx | *.js | *.mjs | *.json | *.go | "") ;;
    *) err "display_name muncul di $f — hanya boleh di Markdown, TypeScript, JSON, atau Go" ;;
  esac
done < <(grep -lF -- "$name" "${files[@]}" 2>/dev/null || true)

# 5. Berkas di `remove` benar-benar ada.
for f in "${kit_files[@]}"; do
  [ -e "$f" ] || err "remove menyebut $f, yang tidak ada"
done

# 6. Penanda bagian khusus kit berpasangan.
while IFS= read -r f; do
  [ -n "$f" ] || continue
  begin=$(grep -c 'gonsu-kit:begin' "$f" || true)
  end=$(grep -c 'gonsu-kit:end' "$f" || true)
  [ "$begin" = "$end" ] || err "$f: $begin penanda gonsu-kit:begin tetapi $end penanda gonsu-kit:end"
done < <(grep -lE 'gonsu-kit:(begin|end)' "${files[@]}" 2>/dev/null || true)

# 7. Tag `v*` memicu release.yml (pipeline rilis PRODUK); kit memakai `kit-v*`.
if git tag --list 'v*' | grep -q .; then
  err "ada tag v* di repository kit — tag kit berawalan kit- (lihat KIT.md)"
fi

if [ "$fail" -ne 0 ]; then exit 1; fi
echo "kit-check: manifes cocok dengan ${#files[@]} berkas"
