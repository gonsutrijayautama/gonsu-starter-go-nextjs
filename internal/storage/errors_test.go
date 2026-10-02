package storage

import (
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestIsUniqueViolation(t *testing.T) {
	unique := &pgconn.PgError{Code: "23505", ConstraintName: "invoices_number_unique"}
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{"constraint yang dicari", unique, true},
		{"terbungkus", fmt.Errorf("menyimpan faktur: %w", unique), true},
		{"constraint lain", &pgconn.PgError{Code: "23505", ConstraintName: "other_unique"}, false},
		{"bukan unique", &pgconn.PgError{Code: "23503", ConstraintName: "invoices_number_unique"}, false},
		{"bukan galat database", fmt.Errorf("connection reset"), false},
		{"nil", nil, false},
	}
	for _, tt := range tests {
		if got := IsUniqueViolation(tt.err, "invoices_number_unique"); got != tt.want {
			t.Errorf("%s: %v, ingin %v", tt.name, got, tt.want)
		}
	}
}
