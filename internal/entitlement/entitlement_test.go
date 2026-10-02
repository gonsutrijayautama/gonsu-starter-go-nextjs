package entitlement

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
)

// stub adalah jawaban hak pakai yang disusun test. Cara kit sampai ke
// jawabannya — lease, agent, masa tenggang — diuji di SDK sendiri; yang diuji
// di sini penegakannya di route.
type stub struct {
	allowed bool
	core    bool
	phase   Phase
}

func (s stub) Allowed(context.Context) bool                { return s.allowed }
func (s stub) Feature(_ context.Context, key string) bool  { return key == Core && s.core }
func (s stub) Limit(context.Context, string) (int64, bool) { return 0, true }
func (s stub) Status(context.Context) Status               { return Status{Phase: s.phase, Allowed: s.allowed} }

// Guard: lisensi tidak aktif menolak mutasi, bukan membaca.
func TestGuard(t *testing.T) {
	tests := []struct {
		name         string
		license      stub
		method       string
		status       int
		code         string
		requiredFeat string
	}{
		{"aktif, GET", stub{true, true, PhaseNormal}, http.MethodGet, 200, "", ""},
		{"aktif, POST", stub{true, true, PhaseNormal}, http.MethodPost, 200, "", ""},
		{"restricted, GET tetap boleh", stub{false, true, PhaseRestricted}, http.MethodGet, 200, "", ""},
		{"restricted, POST ditolak", stub{false, true, PhaseRestricted}, http.MethodPost, 403, apperr.CodeLicenseInactive, ""},
		{"belum aktivasi, GET tetap boleh", stub{false, false, PhaseNotActivated}, http.MethodGet, 200, "", ""},
		{"belum aktivasi, PUT ditolak", stub{false, false, PhaseNotActivated}, http.MethodPut, 403, apperr.CodeLicenseInactive, ""},
		{"fitur tidak dalam paket", stub{true, false, PhaseNormal}, http.MethodGet, 403, apperr.CodeEntitlementRequired, Core},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := Guard(tt.license, Core)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			}))
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequest(tt.method, "/v1/notes", nil))
			if rec.Code != tt.status {
				t.Fatalf("status = %d, want %d", rec.Code, tt.status)
			}
			if tt.code == "" {
				return
			}
			var env struct {
				Error struct {
					Code                string `json:"code"`
					RequiredEntitlement string `json:"required_entitlement"`
				} `json:"error"`
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil || env.Error.Code != tt.code ||
				env.Error.RequiredEntitlement != tt.requiredFeat {
				t.Errorf("envelope = %s", rec.Body.String())
			}
		})
	}
}

// GET /v1/license memakai bentuk JSON kit apa adanya; banner UI membacanya.
func TestStatusHandlerShape(t *testing.T) {
	rec := httptest.NewRecorder()
	StatusHandler(Noop{})(rec, httptest.NewRequest(http.MethodGet, "/v1/license", nil))
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["mode"] != "cloud" || body["phase"] != "UNLICENSED" || body["allowed"] != true {
		t.Errorf("GET /v1/license = %s", rec.Body.String())
	}
}
