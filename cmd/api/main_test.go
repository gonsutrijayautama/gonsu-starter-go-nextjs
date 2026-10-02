package main

import (
	"context"
	"io"
	"log/slog"
	"strings"
	"testing"
)

// Port adalah bagian kontrak chart GONSU. Test ini ada supaya perubahan ke
// port lain — atau menjadikannya konfigurasi — harus lewat keputusan sadar,
// bukan lolos diam-diam.
func TestListensOnContractPort(t *testing.T) {
	if addr != ":8080" {
		t.Fatalf("addr = %q; kontrak chart GONSU adalah :8080", addr)
	}
}

func TestRunRejectsUnknownArguments(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	err := run(context.Background(), []string{"serve", "--port=9000"}, logger)
	if err == nil || !strings.Contains(err.Error(), "migrate") {
		t.Fatalf("err = %v, want galat yang menyebut argumen yang tersedia", err)
	}
}
