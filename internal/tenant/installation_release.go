//go:build !dev

package tenant

import "github.com/google/uuid"

// installationCandidate: ID organization GONSU yang berbentuk UUID dipakai
// apa adanya; selain itu uuidv7 baru, sama dengan ID lain di database ini.
func installationCandidate(gonsuOrg string) (uuid.UUID, error) {
	if id, err := uuid.Parse(gonsuOrg); err == nil && id != uuid.Nil {
		return id, nil
	}
	return uuid.NewV7()
}
