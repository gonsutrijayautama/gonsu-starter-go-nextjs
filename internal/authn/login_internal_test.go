package authn

import "testing"

// Sesudah login pengguna dikembalikan ke ?next=; hanya path di aplikasi ini
// yang diterima, supaya /auth/login tidak menjadi open redirect.
func TestLocalPath(t *testing.T) {
	tests := map[string]string{
		"/notes/":                "/notes/",
		"/notes/?id=1&rev=2":     "/notes/?id=1&rev=2",
		"":                       "",
		"notes/":                 "",
		"//attacker.test/":       "",
		"/\\attacker.test":       "",
		"https://attacker.test/": "",
		"/ok\r\nSet-Cookie: x=1": "",
		"javascript:alert(1)":    "",
	}
	for in, want := range tests {
		if got := localPath(in); got != want {
			t.Errorf("localPath(%q) = %q, want %q", in, got, want)
		}
	}
}

// Sesudah login orang kembali ke `next` — tautan ke halaman detail tetap
// berfungsi melewati sesi yang habis — atau ke halaman pendaratan.
func TestReturnTo(t *testing.T) {
	if got := returnTo(""); got != landing {
		t.Errorf("tanpa next = %q, ingin %q", got, landing)
	}
	if got := returnTo("/notes/?id=1"); got != "/notes/?id=1" {
		t.Errorf("dengan next = %q", got)
	}
}
