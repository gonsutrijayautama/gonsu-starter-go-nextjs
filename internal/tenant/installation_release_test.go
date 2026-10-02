//go:build !dev

package tenant_test

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/tenant"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/testdb"
)

// Pada start pertama, ID organization GONSU yang berbentuk UUID dipakai
// langsung sebagai organization_id.
func TestFirstStartUsesGonsuUUID(t *testing.T) {
	pool := testdb.New(t)
	id := uuid.New()
	inst, err := tenant.EnsureInstallation(context.Background(), pool, id.String())
	if err != nil || inst.OrganizationID != id || inst.GonsuOrganizationID != id.String() {
		t.Errorf("installation = %+v, %v", inst, err)
	}
}
