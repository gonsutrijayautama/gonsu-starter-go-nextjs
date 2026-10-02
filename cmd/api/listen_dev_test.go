//go:build dev

package main

import "testing"

func TestDevBuildHonorsDevHTTPAddr(t *testing.T) {
	t.Setenv("DEV_HTTP_ADDR", "127.0.0.1:18080")
	if got := listenAddr(); got != "127.0.0.1:18080" {
		t.Fatalf("listenAddr() = %q", got)
	}
	t.Setenv("DEV_HTTP_ADDR", "")
	if got := listenAddr(); got != ":8080" {
		t.Fatalf("tanpa DEV_HTTP_ADDR = %q, ingin :8080", got)
	}
}
