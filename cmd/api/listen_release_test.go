//go:build !dev

package main

import "testing"

// Build rilis tidak dapat dipindah port-nya, bahkan bila DEV_HTTP_ADDR
// terbawa dari environment pengembang.
func TestReleaseBuildIgnoresDevHTTPAddr(t *testing.T) {
	t.Setenv("DEV_HTTP_ADDR", "127.0.0.1:18080")
	if got := listenAddr(); got != ":8080" {
		t.Fatalf("listenAddr() = %q; build rilis wajib :8080", got)
	}
}
