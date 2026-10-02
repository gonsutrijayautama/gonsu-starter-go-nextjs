package tenant_test

import (
	"context"
	"sync"
	"testing"

	"github.com/google/uuid"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/tenant"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/testdb"
)

// Replica yang start bersamaan pada database kosong mendapat organization
// yang sama, dan start berikutnya tidak pernah menggantinya.
func TestEnsureInstallationIsStable(t *testing.T) {
	pool := testdb.New(t)
	ctx := context.Background()

	const replicas = 5
	got := make([]tenant.Installation, replicas)
	var wg sync.WaitGroup
	for i := range replicas {
		wg.Go(func() {
			inst, err := tenant.EnsureInstallation(ctx, pool, "")
			if err != nil {
				t.Error(err)
			}
			got[i] = inst
		})
	}
	wg.Wait()
	for _, inst := range got {
		if inst.OrganizationID == uuid.Nil || inst.OrganizationID != got[0].OrganizationID {
			t.Fatalf("organization berbeda antar replica: %v", got)
		}
	}
	again, err := tenant.EnsureInstallation(ctx, pool, "")
	if err != nil || again.OrganizationID != got[0].OrganizationID {
		t.Errorf("start berikutnya = %v, %v", again, err)
	}
}

// ID organization GONSU yang datang belakangan dicatat sebagai atribut —
// tidak menulis ulang organization_id yang sudah dirujuk seluruh baris — dan
// tidak pernah ditimpa ID lain.
func TestEnsureInstallationRecordsGonsuOrganization(t *testing.T) {
	pool := testdb.New(t)
	ctx := context.Background()
	first, err := tenant.EnsureInstallation(ctx, pool, "")
	if err != nil {
		t.Fatal(err)
	}
	later, err := tenant.EnsureInstallation(ctx, pool, "org_gonsu_01")
	if err != nil {
		t.Fatal(err)
	}
	if later.OrganizationID != first.OrganizationID || later.GonsuOrganizationID != "org_gonsu_01" {
		t.Errorf("sesudah GONSU menyerahkan ID = %+v", later)
	}
	other, err := tenant.EnsureInstallation(ctx, pool, "org_gonsu_other")
	if err != nil || other.GonsuOrganizationID != "org_gonsu_01" {
		t.Errorf("ID GONSU tertimpa: %+v, %v", other, err)
	}
}
