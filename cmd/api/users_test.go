package main

import (
	"bytes"
	"context"
	"strings"
	"testing"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/config"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/testdb"
)

func TestParseUsers(t *testing.T) {
	ok := [][]string{
		{"list"},
		{"grant", "--subject", "usr_1", "--role", "administrator"},
		{"grant", "--subject=usr_1", "--role=sales", "--email=a@b.test", "--name", "Budi Santoso"},
		{"suspend", "--subject", "usr_1"},
	}
	for _, args := range ok {
		if _, err := parseUsers(args); err != nil {
			t.Errorf("parseUsers(%q): %v", args, err)
		}
	}
	bad := [][]string{
		{},
		{"hapus"},
		{"grant", "--subject", "usr_1"},
		{"grant", "--role", "staff"},
		{"suspend"},
		{"list", "lebih"},
		{"grant", "--subject", "usr_1", "--role", "staff", "--password", "x"},
	}
	for _, args := range bad {
		if _, err := parseUsers(args); err == nil {
			t.Errorf("parseUsers(%q) diterima", args)
		}
	}
}

// Jalan operator memberi akses login di pemasangan baru.
func TestUsersCommandGrantListSuspend(t *testing.T) {
	pool := testdb.New(t)
	ctx := context.Background()
	a, err := prepare(ctx, pool, config.Config{}, quiet)
	if err != nil {
		t.Fatal(err)
	}
	run := func(args ...string) string {
		t.Helper()
		cmd, err := parseUsers(args)
		if err != nil {
			t.Fatal(err)
		}
		var out bytes.Buffer
		if err := cmd.run(ctx, a, &out); err != nil {
			t.Fatalf("users %v: %v", args, err)
		}
		return out.String()
	}

	run("grant", "--subject", "usr_owner", "--role", "administrator", "--email", "pemilik@example.test")
	list := run("list")
	if !strings.Contains(list, "usr_owner") || !strings.Contains(list, "administrator") ||
		!strings.Contains(list, "ACTIVE") || !strings.Contains(list, "pemilik@example.test") {
		t.Errorf("list =\n%s", list)
	}
	run("suspend", "--subject", "usr_owner")
	if list := run("list"); !strings.Contains(list, "SUSPENDED") {
		t.Errorf("sesudah suspend =\n%s", list)
	}
	// Perubahan akses tercatat, termasuk dari operator.
	if n := countRows(t, pool, `SELECT count(*) FROM user_access_events WHERE source = 'CLI'
		AND actor_user_id IS NULL AND action IN ('GRANTED', 'SUSPENDED')`); n != 2 {
		t.Errorf("riwayat akses dari operator = %d baris, want 2", n)
	}
}
