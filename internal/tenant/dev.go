//go:build dev

package tenant

import (
	"os"

	"github.com/google/uuid"
)

// devOrganization dipakai build pengembangan bila APP_DEV_ORGANIZATION_ID
// kosong. Nilainya tetap supaya data pengembangan bertahan antar restart.
var devOrganization = uuid.MustParse("01920000-0000-7000-8000-000000000001")

// installationCandidate: build pengembangan memakai organization tetap supaya
// data pengembangan yang sudah ada tetap menjadi milik pemasangan ini.
func installationCandidate(string) (uuid.UUID, error) { return DevOrganizationID() }

// DevOrganizationID adalah organization untuk build pengembangan. Hanya ada
// pada build `dev` — binary rilis tidak membawanya.
func DevOrganizationID() (uuid.UUID, error) {
	v := os.Getenv("APP_DEV_ORGANIZATION_ID")
	if v == "" {
		return devOrganization, nil
	}
	return uuid.Parse(v)
}
