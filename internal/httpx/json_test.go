package httpx

import (
	"errors"
	"testing"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
)

// Galat bentuk JSON menyebut field-nya, sama seperti validasi di service:
// tanpa itu formulir hanya dapat menampilkan "isian salah" di atas halaman.
func TestDecodeJSONNamesTheField(t *testing.T) {
	type request struct {
		Title string `json:"title"`
		Total int64  `json:"total"`
	}
	tests := []struct {
		name, body, field string
	}{
		{"teks untuk bilangan", `{"total": "sejuta"}`, "total"},
		{"pecahan untuk bilangan bulat", `{"total": 1.5}`, "total"},
		{"bilangan untuk teks", `{"title": 7}`, "title"},
		{"field tak dikenal", `{"organization_id": "x"}`, "organization_id"},
		{"JSON rusak", `{"title":`, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req request
			err := DecodeJSON([]byte(tt.body), &req)
			var e *apperr.Error
			if !errors.As(err, &e) || e.Code != apperr.CodeValidationFailed {
				t.Fatalf("err = %v, ingin VALIDATION_FAILED", err)
			}
			got := ""
			if len(e.Details) == 1 {
				got = e.Details[0].Field
			}
			if got != tt.field {
				t.Errorf("field = %q, ingin %q (%v)", got, tt.field, e.Details)
			}
		})
	}
}
