// Package apperr memegang katalog kode galat API dan tipe galat yang
// dikembalikan service. Service tidak mengenal HTTP; httpx yang memetakan
// kode ke status dan envelope.
package apperr

import (
	"net/http"
	"time"
)

// Katalog kode galat. Kode tidak diciptakan per handler: kode baru
// ditambahkan di sini, bersama status HTTP-nya, pada PR yang memakainya.
const (
	CodeValidationFailed       = "VALIDATION_FAILED"
	CodeUnauthenticated        = "UNAUTHENTICATED"
	CodePermissionDenied       = "PERMISSION_DENIED"
	CodeEntitlementRequired    = "ENTITLEMENT_REQUIRED"
	CodeLicenseInactive        = "LICENSE_INACTIVE"
	CodeResourceNotFound       = "RESOURCE_NOT_FOUND"
	CodeIdempotencyKeyConflict = "IDEMPOTENCY_KEY_CONFLICT"
	CodeConcurrentModification = "CONCURRENT_MODIFICATION"
	CodeConflict               = "CONFLICT"
	CodeIdentityUnavailable    = "IDENTITY_PROVISIONING_UNAVAILABLE"
	CodeRateLimited            = "RATE_LIMITED"
	CodeInternalError          = "INTERNAL_ERROR"
	CodeControlPlaneRejected   = "CONTROL_PLANE_REJECTED"
	CodeControlPlaneDown       = "CONTROL_PLANE_UNAVAILABLE"
)

var statusByCode = map[string]int{
	CodeValidationFailed:       http.StatusBadRequest,
	CodeUnauthenticated:        http.StatusUnauthorized,
	CodePermissionDenied:       http.StatusForbidden,
	CodeEntitlementRequired:    http.StatusForbidden,
	CodeLicenseInactive:        http.StatusForbidden,
	CodeResourceNotFound:       http.StatusNotFound,
	CodeIdempotencyKeyConflict: http.StatusConflict,
	CodeConcurrentModification: http.StatusConflict,
	CodeConflict:               http.StatusConflict,
	CodeIdentityUnavailable:    http.StatusUnprocessableEntity,
	CodeRateLimited:            http.StatusTooManyRequests,
	CodeInternalError:          http.StatusInternalServerError,
	CodeControlPlaneRejected:   http.StatusBadGateway,
	CodeControlPlaneDown:       http.StatusServiceUnavailable,
}

// FieldError menunjuk satu field yang tidak valid, mis. "number" atau
// "lines[0].quantity".
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// Error adalah galat yang boleh ditampilkan ke pengguna. Galat lain dianggap
// tak terduga: rinciannya hanya masuk log.
type Error struct {
	Code    string
	Message string
	Details []FieldError
	// RequiredEntitlement diisi untuk ENTITLEMENT_REQUIRED.
	RequiredEntitlement string
	// RetryAfter diisi untuk RATE_LIMITED dan menjadi header `Retry-After`.
	RetryAfter time.Duration
}

func (e *Error) Error() string { return e.Code + ": " + e.Message }

// Status adalah status HTTP untuk kode galat ini.
func (e *Error) Status() int {
	if s, ok := statusByCode[e.Code]; ok {
		return s
	}
	return http.StatusInternalServerError
}

// Validation mengembalikan VALIDATION_FAILED beserta rincian per field.
func Validation(message string, details ...FieldError) *Error {
	return &Error{Code: CodeValidationFailed, Message: message, Details: details}
}

// NotFound dipakai juga untuk akses lintas tenant: keberadaan resource milik
// organization lain tidak boleh bocor.
func NotFound(message string) *Error {
	return &Error{Code: CodeResourceNotFound, Message: message}
}

func Unauthenticated(message string) *Error {
	return &Error{Code: CodeUnauthenticated, Message: message}
}

func PermissionDenied(message string) *Error {
	return &Error{Code: CodePermissionDenied, Message: message}
}

func EntitlementRequired(key string) *Error {
	return &Error{
		Code:                CodeEntitlementRequired,
		Message:             "Kemampuan ini tidak termasuk paket langganan Anda.",
		RequiredEntitlement: key,
	}
}

// LicenseInactive: lisensi pemasangan self-host sedang tidak memberi hak
// pakai. Transaksi baru ditolak; membaca dan mengekspor tetap terbuka.
func LicenseInactive(message string) *Error {
	return &Error{Code: CodeLicenseInactive, Message: message}
}

func IdempotencyKeyConflict(message string) *Error {
	return &Error{Code: CodeIdempotencyKeyConflict, Message: message}
}

// ConcurrentModification: data sudah diubah orang lain sejak dibaca
// (optimistic lock gagal). Pengguna perlu memuat ulang, bukan mengulang.
func ConcurrentModification(message string) *Error {
	return &Error{Code: CodeConcurrentModification, Message: message}
}

// Conflict: tindakan bertabrakan dengan keadaan data sekarang, dan mengulang
// tidak menolong — tindakannya yang harus lain. Dua bentuk yang umum:
//
//   - keadaan tidak mengizinkan, mis. mengubah faktur yang sudah terbit;
//   - nilai unik sudah dipakai, mis. nomor faktur — sertakan FieldError
//     supaya formulir menandai field-nya.
//
// Berbeda dengan ConcurrentModification: di sana memuat ulang lalu mengulang
// memang jalan keluarnya.
func Conflict(message string, details ...FieldError) *Error {
	return &Error{Code: CodeConflict, Message: message, Details: details}
}

// ControlPlane membawa jawaban GONSU yang menolak atau tidak dapat melayani
// permintaan produk. Pesannya aman ditampilkan: disusun produk, atau
// kalimat GONSU yang memang ditujukan untuk manusia.
func ControlPlane(code, message string) *Error {
	return &Error{Code: code, Message: message}
}

// RateLimited: melewati batas laju. `RetryAfter`
// menyebut berapa lama sampai boleh mencoba lagi, dan ia WAJIB terisi:
// menolak tanpa menyebut kapan membuat client mencoba terus, dan pembatas
// yang justru memperbanyak permintaan adalah pembatas yang gagal.
func RateLimited(message string, retryAfter time.Duration) *Error {
	return &Error{Code: CodeRateLimited, Message: message, RetryAfter: retryAfter}
}
