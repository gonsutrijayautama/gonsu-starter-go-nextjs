package httpx

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"reflect"
	"strconv"
	"strings"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
)

// MaxBodyBytes membatasi body JSON. Formulir dengan ratusan baris masih jauh
// di bawahnya.
const MaxBodyBytes = 1 << 20

// ReadBody membaca body request dengan batas ukuran. Byte mentahnya
// dikembalikan karena idempotensi membutuhkan sidik jari body yang persis.
func ReadBody(w http.ResponseWriter, r *http.Request) ([]byte, error) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, MaxBodyBytes))
	if err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			return nil, apperr.Validation("Body permintaan terlalu besar.")
		}
		return nil, err
	}
	return body, nil
}

// QueryLimit membaca ?limit= dengan nilai bawaan dan batas atas. Nilai yang
// tidak valid jatuh ke bawaan, bukan galat — ini parameter tampilan.
func QueryLimit(r *http.Request, def, max int) int {
	n, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || n < 1 {
		return def
	}
	return min(n, max)
}

// DecodeJSON mengurai body JSON secara ketat: field yang tidak dikenal
// ditolak, supaya salah ketik nama field di client tidak lolos diam-diam
// sebagai nilai kosong.
//
// Tipe yang salah dan field yang tidak dikenal dijawab dengan FieldError,
// sama seperti validasi di service, supaya formulir dapat menandai field-nya.
func DecodeJSON(body []byte, dst any) error {
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		var typeErr *json.UnmarshalTypeError
		if errors.As(err, &typeErr) && typeErr.Field != "" {
			return apperr.Validation("Isian belum sesuai.", apperr.FieldError{
				Field: typeErr.Field, Message: "Isinya harus " + kindName(typeErr.Type.Kind()) + ".",
			})
		}
		// encoding/json tidak punya tipe galat untuk field tak dikenal; bentuk
		// pesannya `json: unknown field "x"` stabil sejak Go 1.10.
		if name, ok := strings.CutPrefix(err.Error(), "json: unknown field "); ok {
			return apperr.Validation("Isian belum sesuai.", apperr.FieldError{
				Field: strings.Trim(name, `"`), Message: "Field ini tidak dikenal.",
			})
		}
		return apperr.Validation("Body permintaan bukan JSON yang valid: " + err.Error())
	}
	if dec.More() {
		return apperr.Validation("Body permintaan harus berisi tepat satu objek JSON.")
	}
	return nil
}

// kindName menyebut tipe JSON yang diharapkan dengan kata yang dimengerti
// pengguna formulir.
func kindName(k reflect.Kind) string {
	switch k {
	case reflect.String:
		return "teks"
	case reflect.Bool:
		return "ya atau tidak"
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return "bilangan bulat"
	case reflect.Float32, reflect.Float64:
		return "angka"
	case reflect.Slice, reflect.Array:
		return "daftar"
	default:
		return "objek"
	}
}
