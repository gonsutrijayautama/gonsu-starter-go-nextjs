package tenant

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/tenant/store"
)

// Installation adalah organization pemasangan ini.
type Installation struct {
	OrganizationID uuid.UUID
	// GonsuOrganizationID adalah ID kanonik GONSU bila sudah diserahkan.
	GonsuOrganizationID string
}

// EnsureInstallation mengembalikan organization pemasangan ini, dan
// membuatnya bila belum ada. Dipanggil saat start — bukan per
// request.
//
// gonsuOrg adalah ID organization dari GONSU (Secret cloud atau jawaban
// agent), kosong bila belum diserahkan. Pada start pertama ID
// berbentuk UUID dipakai langsung sebagai organization_id; selain itu — dan
// pada pemasangan yang sudah terlanjur punya ID sendiri — ia dicatat sebagai
// atribut, tidak menulis ulang baris mana pun.
func EnsureInstallation(ctx context.Context, db store.DBTX, gonsuOrg string) (Installation, error) {
	candidate, err := installationCandidate(gonsuOrg)
	if err != nil {
		return Installation{}, err
	}
	q := store.New(db)
	var gonsu *string
	if gonsuOrg != "" {
		gonsu = &gonsuOrg
	}
	if err := q.ClaimInstallation(ctx, store.ClaimInstallationParams{
		OrganizationID: candidate, GonsuOrganizationID: gonsu,
	}); err != nil {
		return Installation{}, fmt.Errorf("menyiapkan organization pemasangan: %w", err)
	}
	if gonsuOrg != "" {
		if err := q.RecordGonsuOrganization(ctx, gonsu); err != nil {
			return Installation{}, fmt.Errorf("mencatat organization GONSU: %w", err)
		}
	}
	row, err := q.Installation(ctx)
	if err != nil {
		return Installation{}, fmt.Errorf("membaca organization pemasangan: %w", err)
	}
	inst := Installation{OrganizationID: row.OrganizationID}
	if row.GonsuOrganizationID != nil {
		inst.GonsuOrganizationID = *row.GonsuOrganizationID
	}
	return inst, nil
}
