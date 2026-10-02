package authn_test

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"os"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/gonsutrijayautama/gonsu-one-sdk-go/auth"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authn"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authz"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/entitlement"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/testdb"
)

// Vektor `tenant` kontrak login GONSU (sdk/contract/auth-contract.json,
// salinan di testdata): yang diuji di sini bagian milik produk — pencarian
// `sub` di application_users. Vektor token (13 dari 16 harus ditolak) diuji
// SDK sendiri pada versi yang dipin; CI menjalankannya
// (`go test github.com/gonsutrijayautama/gonsu-one-sdk-go/auth`).
func TestAuthContractTenantVectors(t *testing.T) {
	raw, err := os.ReadFile("testdata/auth-contract.json")
	if err != nil {
		t.Fatal(err)
	}
	var contract struct {
		Tenant []struct {
			Name            string   `json:"name"`
			Subject         string   `json:"subject"`
			GrantedSubjects []string `json:"granted_subjects"`
			Accept          bool     `json:"accept"`
		} `json:"tenant"`
	}
	if err := json.Unmarshal(raw, &contract); err != nil || len(contract.Tenant) == 0 {
		t.Fatalf("kontrak tidak dapat dibaca: %v", err)
	}

	pool := testdb.New(t)
	ctx := context.Background()
	for _, v := range contract.Tenant {
		t.Run(v.Name, func(t *testing.T) {
			org := uuid.New()
			for _, sub := range v.GrantedSubjects {
				if _, err := authn.Grant(ctx, pool, entitlement.Noop{}, org,
					authn.GrantInput{Subject: sub, Role: authz.RoleViewer, Actor: testActor}); err != nil {
					t.Fatal(err)
				}
			}
			err := auth.EnsureGranted(ctx, auth.Claims{Subject: v.Subject}, authn.SubjectLookup(pool, org))
			if accepted := err == nil; accepted != v.Accept {
				t.Errorf("accept = %v, want %v (err %v)", accepted, v.Accept, err)
			}
			if !v.Accept && !errors.Is(err, auth.ErrNotGranted) {
				t.Errorf("penolakan harus ErrNotGranted, bukan %v", err)
			}
		})
	}
}

var testActor = authn.Actor{Name: "test", Source: authn.SourceCLI}

// Akses satu pemasangan tidak berlaku di pemasangan lain, walau `sub`-nya sama.
func TestGrantIsPerInstallation(t *testing.T) {
	pool := testdb.New(t)
	ctx := context.Background()
	a, b := uuid.New(), uuid.New()
	if _, err := authn.Grant(ctx, pool, entitlement.Noop{}, a, authn.GrantInput{Subject: "usr_1", Role: authz.RoleStaff, Actor: testActor}); err != nil {
		t.Fatal(err)
	}
	err := auth.EnsureGranted(ctx, auth.Claims{Subject: "usr_1"}, authn.SubjectLookup(pool, b))
	if !errors.Is(err, auth.ErrNotGranted) {
		t.Errorf("sub pemasangan A diterima pemasangan B: %v", err)
	}
}

func TestGrantValidatesInput(t *testing.T) {
	pool := testdb.New(t)
	ctx := context.Background()
	for _, in := range []authn.GrantInput{
		{Subject: "", Role: authz.RoleStaff, Actor: testActor},
		{Subject: "usr dengan spasi", Role: authz.RoleStaff, Actor: testActor},
		{Subject: "usr_1", Role: "superadmin", Actor: testActor},
		{Subject: "usr_1", Role: authz.RoleStaff},
	} {
		if _, err := authn.Grant(ctx, pool, entitlement.Noop{}, uuid.New(), in); err == nil {
			t.Errorf("Grant(%+v) diterima", in)
		}
	}
}

// Pengaman layar Pengguna & Akses: administrator aktif terakhir tidak dapat
// diturunkan maupun dinonaktifkan, tidak ada yang dapat menonaktifkan dirinya
// sendiri, dan setiap perubahan tercatat di riwayat akses.
func TestAccessChangesHaveSafeguards(t *testing.T) {
	pool := testdb.New(t)
	ctx, p := testdb.Tenant(t, pool, authz.RoleAdministrator)
	org := p.OrganizationID
	admin := authn.NewUserAdmin(pool, entitlement.Noop{}, nil, slog.New(slog.DiscardHandler))

	if _, err := admin.Update(ctx, p.UserID, authn.UpdateRequest{Role: authz.RoleStaff}); err == nil {
		t.Error("administrator terakhir diturunkan")
	}
	if _, err := admin.Update(ctx, p.UserID, authn.UpdateRequest{Status: authn.StatusSuspended}); err == nil {
		t.Error("administrator menonaktifkan dirinya sendiri")
	}

	staffID, err := authn.Grant(context.Background(), pool, entitlement.Noop{}, org, authn.GrantInput{
		Subject: "usr_staff", Role: authz.RoleStaff, Actor: testActor,
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := admin.Update(ctx, staffID, authn.UpdateRequest{Role: authz.RoleViewer}); err != nil {
		t.Fatal(err)
	}
	if _, err := admin.Update(ctx, staffID, authn.UpdateRequest{Status: authn.StatusSuspended}); err != nil {
		t.Fatal(err)
	}
	var actions []string
	rows, err := pool.Query(context.Background(),
		`SELECT action FROM user_access_events WHERE application_user_id = $1 ORDER BY occurred_at, id`, staffID)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var a string
		if err := rows.Scan(&a); err != nil {
			t.Fatal(err)
		}
		actions = append(actions, a)
	}
	if got := strings.Join(actions, ","); got != "GRANTED,ROLE_CHANGED,SUSPENDED" {
		t.Errorf("riwayat akses = %s", got)
	}
}
