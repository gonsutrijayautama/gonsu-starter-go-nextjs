// Package web membawa hasil build frontend ke dalam binary produk: satu
// binary, satu port, tanpa server Node di dalam image.
package web

import (
	"embed"
	"io/fs"
)

// out berisi hasil build frontend statis (`make -C web build`).
//
// out/.gitkeep di-commit supaya pola embed selalu cocok dan binary tetap dapat
// di-compile sebelum frontend di-build. Build frontend yang mengosongkan out/
// wajib menulisnya ulang. Tanpa index.html, httpx
// menyajikan halaman cadangan di "/" sehingga probe tetap mendapat 200.
// Awalan all: wajib — tanpanya direktori _next ikut terbuang.
//
//go:embed all:out
var out embed.FS

// FS mengembalikan isi direktori out sebagai root.
func FS() fs.FS {
	sub, err := fs.Sub(out, "out")
	if err != nil {
		// fs.Sub hanya gagal untuk path yang tidak valid, dan "out" selalu valid.
		panic(err)
	}
	return sub
}
