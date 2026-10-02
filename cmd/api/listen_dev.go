//go:build dev

package main

import (
	"os"
	"strings"
)

// listenAddr: build dev boleh mendengar di alamat lain lewat DEV_HTTP_ADDR
// (`make run` mengisinya), karena :8080 di laptop sering sudah dipakai. Build
// rilis tidak membawa file ini.
func listenAddr() string {
	if v := strings.TrimSpace(os.Getenv("DEV_HTTP_ADDR")); v != "" {
		return v
	}
	return addr
}
